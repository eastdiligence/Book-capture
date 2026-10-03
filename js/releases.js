// 릴리즈 노트. 새 버전을 낼 때 맨 위에 추가하고, sw.js의 VERSION과 js/app.js의 APP_VERSION도 함께 올릴 것.
// (CHANGELOG.md에도 같은 내용을 반영)
export const RELEASES = [
  {
    version: '1.2.0',
    date: '2026-10-03',
    notes: [
      'Google Cloud Vision OCR 엔진 추가 (설정 > OCR 엔진에서 선택, 프록시 주소 입력 필요)',
      '인용 블록 ID가 콜아웃 밖에 있어 [[책#^pN-k]] 링크가 안 되던 문제 수정',
      '저장 전 같은 페이지의 기존 인용과 비교해 중복이면 확인 모달 표시',
      '마지막 저장 위치 힌트, 릴리즈 노트 화면 추가',
      '앱 업데이트가 더 안정적으로 즉시 반영되도록 수정',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-29',
    notes: ['초기 버전: 사진 촬영 → OCR → 수정 → GitHub 커밋'],
  },
];
