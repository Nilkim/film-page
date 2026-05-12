// 테이블 명 한 곳에서 관리.
//
// 같은 Supabase 프로젝트에 향후 다른 커뮤니티 인스턴스(예: wood_page,
// fabric_page 등)가 추가될 가능성을 대비해 모든 테이블에 사이트별 prefix
// 를 붙인다. 인스턴스마다 코드에서 이 상수만 바꾸면 깔끔하게 분리됨.
// (단일 테이블 + site_slug 컬럼 방식은 매 쿼리 WHERE 부담이 있고, custom
// PostgreSQL schema는 RLS/대시보드 사용성에 약간 부담이라 prefix 선택.)
export const TABLE = {
  POSTS: 'film_page_posts',
  COMMENTS: 'film_page_comments',
  LIKES: 'film_page_likes',
} as const;
