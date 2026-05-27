// 관리자 — 주문 관리. Phase 4(결제) 와 함께 채워질 예정.
//
// 현재는 layout 의 네비게이션이 이 경로를 가리키므로 빈 화면이 아닌 안내 표시.
export const dynamic = 'force-dynamic';

export default function AdminOrdersPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-ink">주문</h1>
      <p className="text-sm text-ink-60">
        결제 시스템(Phase 4) 도입 후 활성화됩니다. 결제 완료 주문이 여기에 표시됩니다.
      </p>
    </div>
  );
}
