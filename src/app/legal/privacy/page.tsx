// 개인정보처리방침 — 개인정보보호위원회 표준 양식 기반.
//
// 소규모 사업자 패턴: 개인정보보호책임자는 대표자가 겸임. 결제 관련 위탁(포트원, 각 PG) 명시.
export const metadata = {
  title: '개인정보처리방침 — FilmArtwork',
};

const SHOP = '필름아트웍 (FilmArtwork)';
const COMPANY = '(주)코틸레돈';
const OWNER = '김현구';
const EMAIL = 'cotyledon79@naver.com';
const TEL = '010-4009-1026';
const ADDR = '경기 김포시 대곶면 황금1로 348-1';
const EFFECTIVE = '2026년 5월 27일';

export default function PrivacyPage() {
  return (
    <article className="prose-legal">
      <h1 className="mb-2 text-2xl font-bold text-ink">개인정보처리방침</h1>
      <p className="text-xs text-ink-45">시행일: {EFFECTIVE}</p>

      <p className="mt-4">
        {COMPANY}(이하 "회사")는 {SHOP}(이하 "쇼핑몰") 운영과 관련하여 이용자의 개인정보를 중요시하며,
        「개인정보 보호법」 등 관련 법령을 준수하기 위하여 본 개인정보처리방침을 수립·공개합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
        <p>회사는 결제, 배송, 주문조회를 위해 다음과 같은 최소한의 개인정보를 수집합니다.</p>
        <ul className="list-disc pl-5">
          <li><b>비회원 결제·배송</b>: 이름, 전화번호, 배송 주소, 우편번호, (선택) 요청사항</li>
          <li><b>회원 가입</b>: 소셜 로그인 제공자(Google 등)가 제공하는 이메일·이름·프로필 사진</li>
          <li><b>자동 수집</b>: 서비스 이용 기록, 접속 로그, 쿠키, 기기 정보(브라우저 종류, IP 주소 등)</li>
        </ul>
        <p className="mt-2">개인정보 수집 방법: 결제 단계 폼 입력, 소셜 로그인 제공자 인증, 자동 생성 정보의 수집</p>
      </Section>

      <Section title="2. 개인정보의 수집 및 이용 목적">
        <ul className="list-disc pl-5">
          <li>물품 구매 및 대금 결제, 물품 배송 또는 청구지 발송</li>
          <li>주문 확인 및 본인 식별, 주문조회 서비스 제공</li>
          <li>고객 문의 대응 및 불만 처리</li>
          <li>법령상 의무 준수(전자상거래 등 관련 기록 보관)</li>
          <li>부정 이용 방지 및 비인가 사용 방지</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용 기간">
        <p>회사는 원칙적으로 개인정보의 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 다음의 정보는 관련 법령에 따라 일정 기간 동안 보존합니다.</p>
        <ul className="list-disc pl-5">
          <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
          <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
          <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
          <li>표시·광고에 관한 기록: 6개월 (전자상거래법)</li>
          <li>웹사이트 방문 기록(접속 로그, 접속 IP 등): 3개월 (통신비밀보호법)</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 제3자 제공">
        <p>회사는 이용자의 개인정보를 본 방침에 명시된 범위 내에서만 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다. 단, 다음의 경우는 예외로 합니다.</p>
        <ul className="list-disc pl-5">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </Section>

      <Section title="5. 개인정보 처리의 위탁">
        <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-ink">
                <th className="px-2 py-1.5 text-left font-semibold text-ink">수탁자</th>
                <th className="px-2 py-1.5 text-left font-semibold text-ink">위탁 업무</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-line">
              <tr>
                <td className="px-2 py-1.5">㈜아임포트(포트원)</td>
                <td className="px-2 py-1.5">전자결제 대행</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5">카카오페이·네이버파이낸셜·Google</td>
                <td className="px-2 py-1.5">간편결제 처리</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5">Supabase Inc.</td>
                <td className="px-2 py-1.5">서비스 데이터 보관 및 인증</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5">Netlify, Inc.</td>
                <td className="px-2 py-1.5">웹사이트 호스팅</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="6. 정보주체의 권리·의무 및 행사 방법">
        <p>이용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다.</p>
        <ul className="list-disc pl-5">
          <li>개인정보 열람 요구</li>
          <li>개인정보 정정·삭제 요구</li>
          <li>개인정보 처리 정지 요구</li>
        </ul>
        <p className="mt-2">권리 행사는 이메일(<a href={`mailto:${EMAIL}`} className="underline">{EMAIL}</a>) 또는 서면 등을 통해 회사에 직접 요청하실 수 있으며, 회사는 지체 없이 조치합니다.</p>
      </Section>

      <Section title="7. 개인정보의 파기 절차 및 방법">
        <ul className="list-disc pl-5">
          <li>파기 절차: 보유 기간이 경과한 개인정보는 즉시 파기합니다.</li>
          <li>파기 방법: 전자적 파일은 복구가 불가능한 방법으로 영구 삭제하며, 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.</li>
        </ul>
      </Section>

      <Section title="8. 개인정보의 안전성 확보 조치">
        회사는 개인정보의 안전성 확보를 위해 다음의 조치를 취하고 있습니다.
        <ul className="list-disc pl-5">
          <li>관리적 조치: 내부관리계획 수립·시행, 정기적 점검</li>
          <li>기술적 조치: 접근 권한 관리, 접속 기록 보관, HTTPS 암호화 통신, 보안 프로그램 사용</li>
          <li>물리적 조치: 저장 매체가 보관된 시설의 접근 통제</li>
        </ul>
      </Section>

      <Section title="9. 쿠키의 사용">
        회사는 이용자에게 맞춤 서비스를 제공하기 위해 쿠키 및 로컬 스토리지를 사용합니다.
        장바구니 상태는 이용자 기기의 브라우저 로컬 스토리지에만 저장되며 회사 서버로 전송되지 않습니다.
        이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 일부 서비스 이용에 제약이 있을 수 있습니다.
      </Section>

      <Section title="10. 개인정보 보호책임자">
        회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만 처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다. 본 쇼핑몰은 소규모 사업장으로, <b>대표자가 개인정보 보호책임자를 겸임</b>합니다.
        <ul className="mt-2 list-disc pl-5">
          <li>성명: {OWNER} (대표자 겸임)</li>
          <li>이메일: <a href={`mailto:${EMAIL}`} className="underline">{EMAIL}</a></li>
          <li>전화: {TEL}</li>
        </ul>
      </Section>

      <Section title="11. 권익침해 구제 방법">
        개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의하시기 바랍니다.
        <ul className="list-disc pl-5">
          <li>개인정보분쟁조정위원회 (privacy.kisa.or.kr / 1833-6972)</li>
          <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
          <li>대검찰청 사이버수사과 (spo.go.kr / 1301)</li>
          <li>경찰청 사이버수사국 (ecrm.cyber.go.kr / 182)</li>
        </ul>
      </Section>

      <Section title="12. 개정에 관한 사항">
        본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경 사항의 시행 7일 전부터 본 페이지를 통해 고지합니다.
      </Section>

      <Section title="문의처">
        <ul className="list-none pl-0">
          <li>{COMPANY}</li>
          <li>{ADDR}</li>
          <li>이메일: <a href={`mailto:${EMAIL}`} className="underline">{EMAIL}</a></li>
          <li>전화: {TEL}</li>
        </ul>
      </Section>

      <p className="mt-12 text-xs text-ink-45">본 방침은 {EFFECTIVE}부터 시행됩니다.</p>
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
