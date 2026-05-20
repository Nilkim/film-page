// 메인 피드 컨트롤 — "내글보기" 토글 + 정렬 필터.
//
// 상태를 URL searchParams로 관리한다(?sort=likes&mine=1). 서버 컴포넌트인
// page.tsx가 이 값을 읽어 쿼리/정렬을 결정 — 새로고침·공유·뒤로가기가 자연스럽다.
// 각 버튼은 다른 파라미터를 보존한 채 자기 값만 토글하는 Link.
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const SORTS = [
  { key: 'latest', label: '최신순' },
  { key: 'likes', label: '좋아요순' },
  { key: 'comments', label: '댓글순' },
] as const;

export default function FeedControls({ isLoggedIn }: { isLoggedIn: boolean }) {
  const sp = useSearchParams();
  const sort = sp.get('sort') ?? 'latest';
  const mine = sp.get('mine') === '1';

  // 현재 파라미터를 보존하면서 sort/mine 중 지정한 것만 갱신한 href 생성.
  function href(next: { sort?: string; mine?: boolean }): string {
    const p = new URLSearchParams(sp.toString());
    if (next.sort !== undefined) {
      if (next.sort === 'latest') p.delete('sort');
      else p.set('sort', next.sort);
    }
    if (next.mine !== undefined) {
      if (next.mine) p.set('mine', '1');
      else p.delete('mine');
    }
    const q = p.toString();
    return q ? `/?${q}` : '/';
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] tracking-[0.06em]">
      {isLoggedIn && (
        <Link href={href({ mine: !mine })} className={chip(mine)} scroll={false}>
          내글보기
        </Link>
      )}
      <span className="mx-0.5 hidden h-3 w-px bg-card-line sm:inline-block" aria-hidden="true" />
      {SORTS.map((s) => (
        <Link key={s.key} href={href({ sort: s.key })} className={chip(sort === s.key)} scroll={false}>
          {s.label}
        </Link>
      ))}
    </div>
  );
}

// 활성/비활성 칩 스타일. 활성은 잉크 채움, 비활성은 옅은 보더.
function chip(active: boolean): string {
  return (
    'whitespace-nowrap border px-2.5 py-[5px] transition-colors duration-150 ' +
    (active
      ? 'border-ink bg-ink text-bg'
      : 'border-card-line text-ink-60 hover:border-ink-60 hover:text-ink')
  );
}
