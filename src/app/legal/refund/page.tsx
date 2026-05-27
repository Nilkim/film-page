// 환불·취소 정책 — 전자상거래법 + 주문제작 상품(필름 커팅 도면) 특성 반영.
//
// 필름 커팅 도면은 이용자의 도형/크기 요청에 따라 개별 제작되는 "주문제작" 상품이라,
// 전자상거래법 17조 2항 6호의 청약철회 예외 적용 대상이지만, 회사 자율 정책으로
// 발송 전(미제작 단계)에는 100% 환불을 보장.
export const metadata = {
  title: '환불·취소 정책 — FilmArtwork',
};

const COMPANY = '(주)코틸레돈';
const EMAIL = 'cotyledon79@naver.com';
const TEL = '010-4009-1026';
const EFFECTIVE = '2026년 5월 27일';

export default function RefundPage() {
  return (
    <article className="prose-legal">
      <h1 className="mb-2 text-2xl font-bold text-ink">환불·취소 정책</h1>
      <p className="text-xs text-ink-45">시행일: {EFFECTIVE}</p>

      <Section title="1. 기본 원칙">
        {COMPANY}(이하 "회사")는「전자상거래 등에서의 소비자보호에 관한 법률」(이하 "전자상거래법")에 따른 청약철회 및 환불을 보장합니다. 단, 필름 커팅 도면은 이용자의 요청에 따라 개별 제작되는 <b>주문제작 상품</b>으로서, 제작 단계에 따라 환불 가능 여부가 달라집니다.
      </Section>

      <Section title="2. 청약철회(환불) 가능 기간">
        <ul className="list-disc pl-5">
          <li>이용자는 결제 완료일로부터 7일 이내에 청약철회를 요청할 수 있습니다.</li>
          <li>주문제작 상품(개별 도면 커팅)의 경우, <b>제작 착수 전까지</b>는 자유롭게 취소할 수 있으며 결제 금액 전액을 환불합니다.</li>
          <li>제작에 착수한 이후에는 전자상거래법 제17조 제2항 제5호에 따라 청약철회가 제한될 수 있으나, 다음 사유에 해당하는 경우 환불·교환이 가능합니다.</li>
        </ul>
      </Section>

      <Section title="3. 단계별 환불 정책">
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-ink">
                <th className="px-2 py-1.5 text-left font-semibold text-ink">상품 상태</th>
                <th className="px-2 py-1.5 text-left font-semibold text-ink">환불 비율</th>
                <th className="px-2 py-1.5 text-left font-semibold text-ink">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-line">
              <tr>
                <td className="px-2 py-1.5">결제 완료 / 제작 착수 전</td>
                <td className="px-2 py-1.5"><b>100%</b></td>
                <td className="px-2 py-1.5">결제 후 영업일 1일 이내 요청 권장</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5">제작 착수 후 / 발송 전</td>
                <td className="px-2 py-1.5">자재비 차감 후 환불</td>
                <td className="px-2 py-1.5">필름·잉크 등 실비를 차감하고 잔액 환불</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5">상품 발송 완료 후</td>
                <td className="px-2 py-1.5">단순변심 환불 불가</td>
                <td className="px-2 py-1.5">제품 하자·오배송 시 100% 환불 또는 재발송</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5">제품 수령 후 7일 이내</td>
                <td className="px-2 py-1.5">하자 시 100%</td>
                <td className="px-2 py-1.5">하자 사진과 함께 이메일로 접수</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="4. 환불 절차">
        <ol className="list-decimal pl-5">
          <li>이메일(<a href={`mailto:${EMAIL}`} className="underline">{EMAIL}</a>) 또는 전화({TEL})로 주문번호와 함께 환불 요청 — 사유 기재.</li>
          <li>회사는 요청 접수 후 영업일 기준 1~3일 이내에 환불 가능 여부를 확인하고 회신합니다.</li>
          <li>환불 승인 시 결제 수단과 동일한 경로로 환불을 진행합니다. 카드·간편결제 환불은 PG 사 정책에 따라 영업일 기준 3~7일 이내 처리됩니다.</li>
        </ol>
      </Section>

      <Section title="5. 환불 불가 사유">
        다음에 해당하는 경우 환불이 제한될 수 있습니다.
        <ul className="list-disc pl-5">
          <li>이용자의 책임 있는 사유로 상품이 멸실·훼손된 경우 (단, 상품의 내용을 확인하기 위해 포장을 훼손한 경우 제외)</li>
          <li>이용자의 사용 또는 시간 경과에 의하여 다시 판매하기 곤란할 정도로 상품의 가치가 현저히 감소한 경우</li>
          <li>이미 제작 및 발송이 완료된 주문제작 상품 (단순변심)</li>
          <li>이용자가 요청한 사양(필름 색상·크기·도형)에 따라 정상 제작·배송된 경우</li>
        </ul>
      </Section>

      <Section title="6. 배송비 부담">
        <ul className="list-disc pl-5">
          <li>제품 하자 또는 오배송으로 인한 환불·교환: <b>왕복 배송비 회사 부담</b></li>
          <li>단순 변심에 의한 환불(제작 착수 전 한정): 결제 금액 전액 환불(아직 발송 전이므로 배송비 미발생)</li>
        </ul>
      </Section>

      <Section title="7. 분쟁 해결">
        환불에 관한 회사와 이용자 간 분쟁은 우선 상호 협의를 통해 해결합니다. 협의가 이루어지지 않을 경우 「소비자기본법」에 따른 소비자분쟁조정위원회(국번없이 1372)의 조정에 따를 수 있습니다.
      </Section>

      <Section title="문의처">
        <ul className="list-none pl-0">
          <li>{COMPANY}</li>
          <li>이메일: <a href={`mailto:${EMAIL}`} className="underline">{EMAIL}</a></li>
          <li>전화: {TEL}</li>
          <li>운영시간: 평일 09:00 ~ 18:00</li>
        </ul>
      </Section>

      <p className="mt-12 text-xs text-ink-45">본 정책은 {EFFECTIVE}부터 시행됩니다.</p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-base font-bold text-ink">{title}</h2>
      <div className="text-[14px] leading-[1.75]">{children}</div>
    </section>
  );
}
