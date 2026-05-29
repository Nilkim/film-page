// 가격 표기 컴포넌트 — 할인 시 원가 취소선 + 새 가격 강조.
//
// 한 곳에서 패턴을 통일해 두면 카드/상세/카트/결제 모두 시각이 일관됨.
// size 로 두 가지 톤(상세는 lg, 카드는 sm)을 분기.

type PriceTagProps = {
  displayPrice: number;
  originalPrice: number;
  hasDiscount: boolean;
  size?: 'sm' | 'lg';
  label?: string;     // 예: "패키지 가격". 비우면 가격만.
  className?: string;
};

export default function PriceTag({
  displayPrice,
  originalPrice,
  hasDiscount,
  size = 'lg',
  label,
  className,
}: PriceTagProps) {
  const wrapClass = size === 'lg'
    ? 'text-[13px] text-ink-60'
    : 'text-[11px] text-ink-60';
  const priceClass = 'font-semibold text-ink';
  // 한국 쇼핑몰 표준 — 원가 빨간 취소선 + 할인가 빨간 강조.
  const struckClass = size === 'lg'
    ? 'text-[12px] text-red-500 line-through decoration-red-500'
    : 'text-[10px] text-red-500 line-through decoration-red-500';
  const saleClass = 'font-bold text-red-600';

  if (displayPrice <= 0) return null;

  return (
    <div className={[wrapClass, className].filter(Boolean).join(' ')}>
      {label && <span>{label} </span>}
      {hasDiscount && (
        <span className={struckClass + ' mr-1'} aria-label="원래 가격">
          {originalPrice.toLocaleString('ko-KR')}원
        </span>
      )}
      <span className={hasDiscount ? saleClass : priceClass}>
        {displayPrice.toLocaleString('ko-KR')}원
      </span>
    </div>
  );
}
