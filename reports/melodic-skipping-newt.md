# 카드 피드 + 게시글(직접 작성 / 외부 링크 임베드) 구현 플랜

## Context

FilmPage는 사용자(주로 인플루언서/일반 고객)가 FilmCutting 에디터로 만든 작품을 자랑하는 커뮤니티 사이트다. 현재 메인 페이지는 Hero 한 섹션뿐이고, 게시판은 미구현 상태(SQL 스키마만 있음). 이번 단계는 **디자인 제외, 기능만** 우선해서 게시글 시스템을 한 사이클(피드 → 상세 → 작성) 끝낸다.

핵심 요구는 두 가지:

1. **외부 콘텐츠 임베드** — 인플루언서가 자기 블로그/YouTube/Instagram의 글을 *우리 사이트 안에서* 보여주고 싶어함(트래픽이 외부로 빠지지 않게). 단, 모든 외부 사이트를 iframe으로 임베드할 수는 없으므로 **하이브리드 전략**을 쓴다.
2. **모든 카드는 FilmCutting 주문번호(`order_code`)와 연결** — 어떤 작품 이야기인지 명시하기 위함.

## 결정 사항 (사용자 확정)

| 항목 | 결정 |
|------|------|
| 외부 링크 전략 | **하이브리드** — YouTube/Instagram은 공식 임베드, 그 외는 OG 메타 미리보기 + "원본 보기" 새 탭 |
| 작성 UX | **필드 자동 감지** — 한 폼에 URL/제목/본문 입력란을 두고, URL이 있으면 외부 링크 게시글로 분류 |
| `order_code` | **필수** — 직접 작성/외부 링크 모두 강제 |
| 범위 | **피드 + 상세 + 작성** (댓글/좋아요는 다음 단계) |

## 스키마 변경 — [supabase/posts.sql](../supabase/posts.sql)

`film_page_posts` 테이블에 외부 링크용 컬럼 추가 + `order_code` NOT NULL 화. 운영 데이터 없으므로 단일 파일 그대로 수정 후 Supabase SQL Editor에서 재실행.

```sql
-- film_page_posts 추가 컬럼
post_type text not null default 'text' check (post_type in ('text', 'link')),
external_url text,                          -- post_type='link'일 때 사용
source_platform text,                       -- 'youtube' | 'instagram' | 'blog' | null
og_title text,                              -- 외부 페이지 OG 메타 캐시
og_description text,
og_image text,
-- 변경: order_code 필수화
order_code text not null,
-- 일관성 제약: link면 external_url 반드시 있음
constraint film_page_posts_link_requires_url
  check (post_type = 'text' or (post_type = 'link' and external_url is not null)),
-- title은 link 게시글에서 OG 제목으로 자동 채워질 수 있으므로 그대로 NOT NULL 유지
-- body는 link 게시글에서 빈 문자열 허용 — 기존 check(char_length<=10000)는 0도 통과
```

`title not null` 제약은 그대로 유지하되, link 타입의 경우 작성 페이지에서 OG 제목을 자동 채워주거나 사용자가 직접 입력하게 한다.

## 파일별 변경

### 1. [src/lib/db.ts](../src/lib/db.ts) — 상수 추가

```ts
export const POST_TYPE = { TEXT: 'text', LINK: 'link' } as const;
export const SOURCE_PLATFORM = {
  YOUTUBE: 'youtube',
  INSTAGRAM: 'instagram',
  BLOG: 'blog',
} as const;
```

### 2. [src/lib/embed.ts](../src/lib/embed.ts) — **신규**, 임베드 가능성 판별 유틸 (순수 함수)

- `detectPlatform(url)` → `'youtube' | 'instagram' | 'blog'`
- `toEmbedUrl(url, platform)` → YouTube/Instagram의 경우 임베드용 URL로 변환
  - YouTube: `youtube.com/watch?v=XXX` 또는 `youtu.be/XXX` → `youtube.com/embed/XXX`
  - Instagram: `instagram.com/p/XXX/` → `instagram.com/p/XXX/embed/`
  - blog: `null` (임베드 불가 표시)
- `isEmbeddable(platform)` → boolean

테스트 가능하도록 외부 의존성 없이.

### 3. [src/lib/og.ts](../src/lib/og.ts) — **신규**, 서버 전용 OG 메타 추출

- `fetchOgMeta(url)` → `{ title, description, image }`
- `fetch()` + 응답 HTML에서 `<meta property="og:*">` 정규식 파싱 (cheerio 등 추가 의존성 없이 가벼운 정규식으로 충분)
- 타임아웃 5초, 응답 200KB까지만 읽어 메모리/시간 보호

### 4. [src/app/api/og/route.ts](../src/app/api/og/route.ts) — **신규**, 클라이언트가 호출할 OG 프록시

- `GET /api/og?url=<encoded>`
- 인증 사용자만 호출 가능(`getUser()` 검증 — 익명 OG 스크래핑 방지)
- 내부적으로 `lib/og.ts`의 `fetchOgMeta()` 호출
- Next.js 16 Route Handler 규약 확인: `node_modules/next/dist/docs/`의 routing/route-handlers 문서를 보고 정확한 시그니처 적용

### 5. [src/app/page.tsx](../src/app/page.tsx) — 카드 그리드로 재구성

기존 Hero 섹션을 제거(또는 상단에 작게 유지)하고 카드 그리드 표시:

- **첫 번째 카드**: 정적, "직접 만들기" 카드 — `CUTTING_APP_URL`로 새 탭 이동 (기존 로직 재사용)
- **두 번째부터**: `film_page_posts`에서 최신순(`created_at desc`) SELECT한 데이터를 `PostCard`로 렌더
- 비로그인 사용자도 피드 조회 가능 (RLS의 select_all 정책에 의존)
- Server Component로 작성 → Supabase server client 사용

### 6. [src/components/PostCard.tsx](../src/components/PostCard.tsx) — **신규**

게시글 카드 한 장. props: `post`. 클릭 시 `/posts/[id]`로 이동(Next.js `<Link>`).

표시:
- 썸네일: `og_image` 또는 `image_urls[0]` 또는 플랫폼별 placeholder
- 제목: `title` 또는 `og_title`
- 플랫폼 뱃지: `source_platform` (link 게시글일 때만)
- `order_code` 표시
- 작성자 이름 (auth.users → user_metadata 조인은 비용↑ → 우선 `user_id` 일부 또는 가져온 user_metadata 표시. 자세한 건 구현 단계에서 결정)

### 7. [src/components/CreateCard.tsx](../src/components/CreateCard.tsx) — **신규**

첫 번째 "직접 만들기" 정적 카드. `CUTTING_APP_URL`로 새 탭 이동하는 `<a>`.

### 8. [src/app/posts/[id]/page.tsx](../src/app/posts/[id]/page.tsx) — **신규**, 상세 페이지

서버에서 post 조회 후 `post_type`에 따라 분기:

- `text` → title + body + image_urls + order_code 렌더
- `link` + 임베드 가능 플랫폼(YouTube/Instagram) → 페이지 상단에 "원본: <도메인>" 헤더 + `<iframe src={toEmbedUrl(...)}>` 풀화면, 하단에 `order_code` 표시
- `link` + 임베드 불가(blog) → OG 카드(이미지/제목/설명) + "원본 보기" 버튼(새 탭) + `order_code` 표시

iframe sandbox 속성으로 보안 가드(`sandbox="allow-scripts allow-same-origin allow-popups"` 등 최소 권한).

### 9. [src/app/posts/new/page.tsx](../src/app/posts/new/page.tsx) — **신규**, 작성 페이지

미들웨어로 보호 또는 페이지 진입 시 `getUser()` 체크 후 비로그인이면 `/login`으로 리다이렉트.

Client Component로 폼 운영(URL 입력 디바운스 → `/api/og`로 메타 자동 채움):

폼 필드:
- **URL** (선택): 입력하면 디바운스 후 `/api/og` 호출, OG 메타로 제목/설명/이미지/플랫폼 자동 감지
- **제목** (필수): 비어있고 URL이 있으면 OG 제목으로 자동 채움
- **본문** (텍스트 게시글에서 권장, 링크 게시글에서 선택)
- **order_code** (필수): 입력란
- **이미지 업로드**: 이번 단계 범위에서 제외(스키마는 이미 `image_urls` 있음, 다음 단계)

제출 시 Server Action(`src/app/posts/new/actions.ts`)에서 `post_type` 결정(URL 유무) + Supabase INSERT. 성공 시 `/posts/[id]`로 redirect.

### 10. [src/app/posts/new/actions.ts](../src/app/posts/new/actions.ts) — **신규**

```ts
'use server'
export async function createPost(formData: FormData) {
  // 1. supabase server client + getUser()
  // 2. URL 유무로 post_type 결정
  // 3. URL 있으면 detectPlatform() 호출해 source_platform 저장
  // 4. og_* 필드는 클라이언트가 미리 fetch한 값 그대로 저장 (서버에서 재검증해도 됨)
  // 5. order_code 빈 값 거부
  // 6. supabase.from(TABLE.POSTS).insert(...).select('id').single()
  // 7. redirect(`/posts/${id}`)
}
```

### 11. [src/middleware.ts](../src/middleware.ts) — 검토만, 필요 시 보호 경로 추가

`/posts/new`만 인증 필수. 현재 미들웨어는 세션 갱신만 하므로 페이지 내부에서 `getUser()` 체크로 처리하는 편이 더 간단. 미들웨어 변경은 안 해도 됨.

## 재사용할 기존 자산

| 위치 | 용도 |
|------|------|
| [src/lib/supabase/server.ts](../src/lib/supabase/server.ts) | RSC/Route Handler/Server Action용 Supabase 클라이언트 |
| [src/lib/supabase/client.ts](../src/lib/supabase/client.ts) | 작성 페이지(Client Component)에서 사용 |
| [src/lib/db.ts](../src/lib/db.ts) | `TABLE.POSTS` 등 테이블 명 상수 — 새 상수도 여기 추가 |
| [src/components/Header.tsx](../src/components/Header.tsx) | 모든 페이지 상단 헤더 그대로 사용 |
| [src/app/actions/auth.ts](../src/app/actions/auth.ts) | Server Action 패턴 참고용 |

## Next.js 16 주의

[AGENTS.md](../AGENTS.md)에서 경고한 대로 표준 Next.js와 다른 부분이 있을 수 있다. 작성 페이지/Route Handler/Server Action 구현 직전에 반드시 확인:

- `node_modules/next/dist/docs/` 내 routing, server-actions, route-handlers, dynamic-routes 관련 문서
- 특히 `params`/`searchParams`의 async 여부, Server Action에서 `redirect()` 처리, `formAction` prop 지원 여부

## 검증

1. **DB 마이그레이션**: Supabase SQL Editor에 수정된 `posts.sql` 실행 → 컬럼 변경 확인
2. **피드 렌더**: `npm run dev`로 띄운 뒤 `/` 접속 — 첫 카드 "직접 만들기" 확인, 빈 DB일 때 안내 메시지 표시 확인
3. **수동 데이터 삽입 후 카드 렌더 확인**: SQL Editor로 text/link 게시글 한 건씩 INSERT 후 메인에서 카드로 나오는지 확인
4. **작성 폼**:
   - 비로그인 → `/login` 리다이렉트
   - 로그인 + URL 없이 제출 → 텍스트 게시글 생성
   - 로그인 + 유튜브 URL 입력 → OG 자동 채움 + 상세 페이지에서 iframe 임베드 표시
   - 로그인 + 네이버 블로그 URL 입력 → OG 미리보기 카드 + "원본 보기" 버튼
   - `order_code` 비우고 제출 → 검증 에러
5. **임베드 분기**:
   - YouTube `watch?v=` 링크 → 임베드 iframe 출력 확인
   - Instagram 게시글 링크 → 임베드 iframe 출력 확인
   - 네이버 블로그(`blog.naver.com/...`) 링크 → iframe 안 띄우고 OG 카드만 표시
6. **보안**:
   - `/api/og`를 비로그인 상태에서 호출하면 401 응답
   - iframe `sandbox` 속성 확인 (DevTools)

## 다음 단계(이번 범위 밖)

- 이미지 업로드(Supabase Storage)
- 댓글(`film_page_comments`), 좋아요(`film_page_likes`)
- 디자인/스타일링 (메모리에 "다음 세션 메인 작업: 페이지 꾸미기"로 이미 기록됨)
- order_code → FilmCutting orders 테이블 실제 조회(현재는 text만 저장, 검증 없음)
