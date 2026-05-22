// 메인 페이지 — 카드 그리드.
//
// 성능: 이 페이지는 ISR로 캐시된다(아래 revalidate). 공개 피드 데이터는 모든
// 사용자에게 동일하므로 쿠키를 안 보는 anon 클라이언트로 읽어 정적/CDN 서빙이
// 가능하게 한다. 인증·정렬·내글 필터 등 개인화는 client <Feed>가 처리.
// (이전엔 supabase.auth.getUser() + searchParams로 매 요청 동적 렌더 → 콜드 스타트 8초)
//
// 새 글 작성 시 posts/new/actions.ts가 revalidatePath('/')를 호출해 즉시 갱신,
// 그 외엔 최대 60초 후 백그라운드 재생성.
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Feed, { type FeedPost } from '@/components/Feed';
import { createAnonClient } from '@/lib/supabase/anon';
import { TABLE, type Post } from '@/lib/db';

export const revalidate = 60;

export default async function Home() {
  const supabase = createAnonClient();
  // nested count로 좋아요/댓글 카운트까지 한 번에. (쿠키 미사용 → ISR 캐시 가능)
  const { data: posts } = await supabase
    .from(TABLE.POSTS)
    .select('*, film_page_likes(count), film_page_comments(count)')
    .order('created_at', { ascending: false })
    .limit(60);

  type Raw = Post & {
    film_page_likes?: { count: number }[];
    film_page_comments?: { count: number }[];
  };
  // client로 넘기기 전에 카운트를 평탄화 — Feed는 likeCount/commentCount만 본다.
  const list: FeedPost[] = ((posts as Raw[] | null) ?? []).map((p) => ({
    ...p,
    likeCount: p.film_page_likes?.[0]?.count ?? 0,
    commentCount: p.film_page_comments?.[0]?.count ?? 0,
  }));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-[clamp(16px,4vw,40px)]">
      <Header />
      <Feed posts={list} />
      <Footer />
    </div>
  );
}
