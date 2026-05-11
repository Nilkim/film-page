# FilmPage

코틸레돈 브랜드의 **필름 커팅 작품 커뮤니티**. 사용자들이 [FilmCutting](https://filmcutting.netlify.app) 에디터로 만든 도면과 완성된 작품 사진을 공유하고, 다른 사람의 도면을 보며 영감을 받을 수 있는 사이트.

## 스택

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- (예정) Supabase Auth (Google OAuth) + Supabase Postgres
- (예정) Supabase는 FilmCutting과 같은 프로젝트를 재사용 — 게시글에 `order_code`로 도면 연결

## 핵심 동선

- **조회**: 비로그인 자유 (피드, 게시글 상세, 댓글 읽기)
- **작성**: Google 로그인 필요 (게시글, 댓글, 좋아요)
- **커팅**: "커팅 시작하기" 버튼으로 외부 FilmCutting 에디터로 이동. 주문이 끝나면 발급되는 `order_code`를 게시글 작성 시 첨부 가능

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## 폴더 구조

```
src/
└── app/
    ├── layout.tsx     루트 레이아웃, metadata, 폰트
    ├── page.tsx       MVP 홈 (Hero + "커팅 시작하기")
    └── globals.css    Tailwind 기본 + 글로벌 스타일
```

## 다음 작업

- Supabase 클라이언트 셋업 (`lib/supabase.ts`) — 환경변수는 FilmCutting과 같은 프로젝트 키 재사용
- Google OAuth 로그인 페이지 (`app/login/page.tsx`)
- 게시글 피드 (`app/posts/page.tsx`) + 상세 (`app/posts/[id]/page.tsx`)
- 게시글 작성 form (`app/posts/new/page.tsx`) — 로그인 필수
- `posts` 테이블 schema 추가 (Supabase) — `order_code`로 FilmCutting `orders` 참조

## 관련 프로젝트

- [FilmCutting](https://github.com/Nilkim/FilmCutting) — 커팅 에디터 (별도 repo). 이 커뮤니티는 그 결과물을 모아 공유하는 layer.
