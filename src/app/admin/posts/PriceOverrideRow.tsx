// 한 행 = 한 게시물(패키지) 의 가격 오버라이드 폼.
//
// 입력값 검증은 서버 액션이 본문에서, 여기서는 useFormStatus 로 진행 표시만.
// 폼 두 개(저장 / 삭제)를 같은 행에 두고, 새 가격 input 은 저장 폼 안에 둔다.
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { setPriceOverride, clearPriceOverride } from './actions';
import type { PriceOverride } from '@/lib/db';

type Props = {
  post: { id: string; title: string; package_code: string };
  liveOriginal: number;
  override: PriceOverride | null;
};

export default function PriceOverrideRow({ post, liveOriginal, override }: Props) {
  const [newPrice, setNewPrice] = useState<string>(
    override ? String(override.override_price) : '',
  );
  const [reason, setReason] = useState<string>(override?.reason ?? '');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const display = override ? override.override_price : liveOriginal;
  const hasDiscount = !!override && override.override_price < liveOriginal;

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('original_price', String(liveOriginal));
    startTransition(async () => {
      const r = await setPriceOverride(fd);
      setMsg(r.ok ? '저장됨' : r.error);
    });
  }

  function handleClear() {
    if (!confirm('할인을 해제할까요? (원가로 복귀)')) return;
    const fd = new FormData();
    fd.set('package_code', post.package_code);
    startTransition(async () => {
      const r = await clearPriceOverride(fd);
      setMsg(r.ok ? '해제됨' : r.error);
      if (r.ok) {
        setNewPrice('');
        setReason('');
      }
    });
  }

  const disabled = pending || liveOriginal <= 0;

  return (
    <tr className="border-b border-card-line last:border-b-0">
      <td className="px-3 py-2 align-top">
        <Link href={`/posts/${post.id}`} className="line-clamp-1 text-ink hover:underline">
          {post.title}
        </Link>
      </td>
      <td className="px-3 py-2 align-top font-mono text-xs text-ink-70">{post.package_code}</td>
      <td className="px-3 py-2 align-top text-right tabular-nums text-ink-60">
        {liveOriginal > 0 ? `${liveOriginal.toLocaleString('ko-KR')}원` : '—'}
      </td>
      <td className="px-3 py-2 align-top text-right tabular-nums">
        <div className={hasDiscount ? 'font-bold text-ink' : 'text-ink-70'}>
          {display > 0 ? `${display.toLocaleString('ko-KR')}원` : '—'}
        </div>
        {hasDiscount && (
          <div className="text-[10px] text-ink-45 line-through tabular-nums">
            {liveOriginal.toLocaleString('ko-KR')}원
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <form id={`set-${post.id}`} onSubmit={handleSave} className="flex items-center gap-1">
          <input type="hidden" name="package_code" value={post.package_code} />
          <input
            type="number"
            name="override_price"
            min={0}
            max={liveOriginal > 0 ? liveOriginal - 1 : undefined}
            step={100}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="원"
            disabled={disabled}
            className="w-24 rounded border border-card-line bg-bg px-2 py-1 text-right text-sm tabular-nums focus:border-ink focus:outline-none"
          />
        </form>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          form={`set-${post.id}`}
          type="text"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="할인 사유 (선택)"
          disabled={disabled}
          className="w-40 rounded border border-card-line bg-bg px-2 py-1 text-sm focus:border-ink focus:outline-none"
        />
      </td>
      <td className="px-3 py-2 align-top text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="submit"
            form={`set-${post.id}`}
            disabled={disabled || !newPrice}
            className="rounded border border-ink bg-ink px-2.5 py-1 text-xs text-bg transition-colors hover:opacity-90 disabled:opacity-40"
          >
            {pending ? '...' : '저장'}
          </button>
          {override && (
            <button
              type="button"
              onClick={handleClear}
              disabled={pending}
              className="rounded border border-card-line px-2.5 py-1 text-xs text-ink-60 transition-colors hover:border-ink hover:text-ink"
            >
              해제
            </button>
          )}
        </div>
        {msg && <div className="mt-1 text-[10px] text-ink-60">{msg}</div>}
      </td>
    </tr>
  );
}
