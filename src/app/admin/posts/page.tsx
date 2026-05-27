// 관리자 — 게시물(=패키지) 가격 오버라이드 표.
//
// 한 행 = 한 게시물. 원가(실시간 계산) / 현재 노출가 / 새 가격 입력 / 저장·삭제.
// 원가는 패키지의 phone 으로 RPC 호출해 합산. N+1 비용이 있지만 admin 화면이라
// 트래픽이 적고 캐시되지 않아 OK.
import Link from 'next/link';
import { createAnonClient } from '@/lib/supabase/anon';
import { TABLE, PACKAGES_TABLE, type Post, type OrderPackage } from '@/lib/db';
import { findOrdersByPhone } from '@/lib/orders';
import { findPriceOverrides } from '@/lib/pricing';
import PriceOverrideRow from './PriceOverrideRow';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  const supabase = createAnonClient();

  // 최근 게시물 50개. 더 많아지면 페이지네이션 추가.
  const { data: postRows } = await supabase
    .from(TABLE.POSTS)
    .select('id, title, package_code, cover_image, og_image, image_urls, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(50);
  const posts = (postRows ?? []) as Pick<Post, 'id' | 'title' | 'package_code' | 'cover_image' | 'og_image' | 'image_urls' | 'created_at' | 'user_id'>[];

  // 패키지 일괄 로드 — package_code → OrderPackage 매핑.
  const codes = posts.map((p) => p.package_code).filter(Boolean);
  const { data: pkgRows } = await supabase
    .from(PACKAGES_TABLE)
    .select('*')
    .in('package_code', codes);
  const pkgByCode = new Map((pkgRows ?? []).map((p) => [p.package_code, p as OrderPackage]));

  // 오버라이드 일괄 로드.
  const overrides = await findPriceOverrides(supabase, codes);

  // 패키지별 원가(실시간) — phone 별로 묶어 RPC 호출 횟수를 줄임.
  const phoneSet = new Set<string>();
  for (const pkg of pkgByCode.values()) if (pkg.phone) phoneSet.add(pkg.phone);
  const phoneToSummaries = new Map<string, Map<string, number>>();
  await Promise.all(
    Array.from(phoneSet).map(async (phone) => {
      const summaries = await findOrdersByPhone(supabase, phone);
      const map = new Map<string, number>();
      for (const s of summaries) map.set(s.code, s.total_price ?? 0);
      phoneToSummaries.set(phone, map);
    }),
  );

  const rows = posts.map((post) => {
    const pkg = pkgByCode.get(post.package_code);
    let liveOriginal = 0;
    if (pkg?.phone) {
      const codeToPrice = phoneToSummaries.get(pkg.phone);
      if (codeToPrice) {
        liveOriginal = pkg.order_codes.reduce((sum, c) => sum + (codeToPrice.get(c) ?? 0), 0);
      }
    }
    return {
      post,
      override: overrides.get(post.package_code) ?? null,
      liveOriginal,
    };
  });

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-ink">게시물·가격</h1>
        <span className="text-xs text-ink-60">최근 {rows.length}개</span>
      </header>

      <div className="overflow-x-auto rounded-[6px] border border-card-line bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-card-line bg-ink-06 text-left text-[11px] uppercase tracking-[0.12em] text-ink-60">
            <tr>
              <th className="px-3 py-2 font-semibold">제목</th>
              <th className="px-3 py-2 font-semibold">패키지 코드</th>
              <th className="px-3 py-2 font-semibold text-right">원가</th>
              <th className="px-3 py-2 font-semibold text-right">노출가</th>
              <th className="px-3 py-2 font-semibold">새 가격</th>
              <th className="px-3 py-2 font-semibold">사유</th>
              <th className="px-3 py-2 font-semibold text-right">동작</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ post, override, liveOriginal }) => (
              <PriceOverrideRow
                key={post.id}
                post={{ id: post.id, title: post.title, package_code: post.package_code }}
                liveOriginal={liveOriginal}
                override={override}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ink-60">
                  게시물이 없어요.{' '}
                  <Link href="/posts/new" className="underline">새 글 작성</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-60">
        새 가격은 <b>원가보다 낮아야</b> 저장됩니다. 저장 시 카드/상세에 즉시 반영(취소선 + 할인가 노출).
      </p>
    </div>
  );
}
