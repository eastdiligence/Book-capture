// Book-capture 앱의 OCR 프록시 (Cloudflare Worker).
// 역할: 앱이 보낸 사진(base64)을 Google Cloud Vision API로 대신 요청해, API 키가 폰/브라우저에 노출되지 않게 한다.
// 배포 후 Worker 설정 → Settings → Variables and Secrets에 아래 두 개를 Secret으로 등록할 것.
//   GOOGLE_VISION_API_KEY: Google Cloud Vision API 키
//   PROXY_SECRET: 아무 값이나 정해서 넣는 비밀키. 앱 설정의 "OCR 프록시 비밀키"에 똑같이 입력해야 함.
//                 (이게 없으면 Worker 주소를 아는 누구나 요청을 보낼 수 있어 과금 위험이 있음)
// 앱 저장소 코드가 아니라 Cloudflare 대시보드에 별도로 붙여넣어 배포한다 (README.md 참고).

const ALLOWED_ORIGIN = '*'; // 필요하면 본인 GitHub Pages 주소(https://사용자명.github.io)로 제한

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Secret',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    // PROXY_SECRET 미설정이거나 불일치하면 차단 (설정을 깜빡한 경우도 안전하게 막기 위해 기본은 거부)
    if (!env.PROXY_SECRET || request.headers.get('X-Proxy-Secret') !== env.PROXY_SECRET) {
      return new Response('인증 실패', { status: 401, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('잘못된 요청', { status: 400, headers: cors });
    }
    if (!body?.image) return new Response('image 필드가 없습니다', { status: 400, headers: cors });

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: body.image },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['ko', 'en'] },
            },
          ],
        }),
      }
    );

    if (!visionRes.ok) {
      const detail = await visionRes.text();
      let message = detail;
      try {
        message = JSON.parse(detail)?.error?.message ?? detail;
      } catch {
        // 응답이 JSON이 아니면 원문 그대로 보여줌
      }
      return new Response(`Vision API 오류 (${visionRes.status}): ${message}`, { status: 502, headers: cors });
    }

    const data = await visionRes.json();
    const result = data.responses?.[0] ?? {};
    if (result.error) {
      return new Response(result.error.message ?? 'Vision API 오류', { status: 502, headers: cors });
    }

    return new Response(JSON.stringify({ fullTextAnnotation: result.fullTextAnnotation ?? null }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
