// Book-capture 앱의 OCR 프록시 (Cloudflare Worker).
// 역할: 앱이 보낸 사진(base64)을 Google Cloud Vision API로 대신 요청해, API 키가 폰/브라우저에 노출되지 않게 한다.
// 배포 후 Worker 설정 → Settings → Variables and Secrets에 GOOGLE_VISION_API_KEY를 Secret으로 등록할 것.
// 앱 저장소 코드가 아니라 Cloudflare 대시보드에 별도로 붙여넣어 배포한다 (README.md 참고).

const ALLOWED_ORIGIN = '*'; // 필요하면 본인 GitHub Pages 주소(https://사용자명.github.io)로 제한

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

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
      return new Response(`Vision API 오류 (${visionRes.status})`, { status: 502, headers: cors });
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
