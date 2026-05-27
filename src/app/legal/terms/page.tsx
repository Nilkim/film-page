// 이용약관 — 공정거래위원회 표준 전자상거래 이용약관 기반.
//
// 코틸레돈/FilmArtwork 운영 정책에 맞춰 일부 항목 조정. 추후 변경 시 시행일·이력 갱신.
export const metadata = {
  title: '이용약관 — FilmArtwork',
};

const SHOP = '필름아트웍 (FilmArtwork)';
const COMPANY = '(주)코틸레돈';
const SITE = 'https://film-artwork.com';
const EMAIL = 'cotyledon79@naver.com';
const TEL = '010-4009-1026';
const EFFECTIVE = '2026년 5월 27일';

export default function TermsPage() {
  return (
    <article className="prose-legal">
      <h1 className="mb-2 text-2xl font-bold text-ink">이용약관</h1>
      <p className="text-xs text-ink-45">시행일: {EFFECTIVE}</p>

      <Section title="제1조 (목적)">
        본 약관은 {COMPANY}(이하 "회사")가 운영하는 {SHOP}(이하 "쇼핑몰")에서 제공하는 인터넷 관련 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
      </Section>

      <Section title="제2조 (정의)">
        <ol className="list-decimal pl-5">
          <li>"쇼핑몰"이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 또는 용역을 거래할 수 있도록 설정한 가상의 영업장을 말하며, 사이트({SITE})를 통해 운영됩니다.</li>
          <li>"이용자"란 쇼핑몰에 접속하여 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</li>
          <li>"회원"이란 쇼핑몰에 가입하여 지속적으로 서비스를 이용할 수 있는 자를, "비회원"이란 회원 가입 없이 서비스를 이용하는 자를 말합니다.</li>
          <li>"패키지"란 이용자가 회사의 필름 커팅 도면 서비스(FilmCutting)에서 생성한 주문을 묶어 쇼핑몰에 게시·판매할 수 있는 단위를 말합니다.</li>
        </ol>
      </Section>

      <Section title="제3조 (약관의 게시와 개정)">
        <ol className="list-decimal pl-5">
          <li>회사는 본 약관의 내용을 이용자가 쉽게 알 수 있도록 쇼핑몰 하단에 게시합니다.</li>
          <li>회사는 「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에 관한 법률」, 「전자문서 및 전자거래기본법」, 「전자금융거래법」, 「전자서명법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」, 「방문판매 등에 관한 법률」, 「소비자기본법」 등 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</li>
          <li>회사가 약관을 개정할 경우 적용일자 및 개정 사유를 명시하여 현행 약관과 함께 쇼핑몰의 초기화면 또는 본 페이지에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다. 다만 이용자에게 불리한 약관의 개정은 최소 30일 이상의 사전 유예기간을 두고 공지합니다.</li>
        </ol>
      </Section>

      <Section title="제4조 (서비스의 제공 및 변경)">
        <ol className="list-decimal pl-5">
          <li>회사는 다음과 같은 업무를 수행합니다.
            <ul className="mt-1 list-disc pl-5">
              <li>필름 커팅 도면 및 관련 작품의 게시·공유</li>
              <li>도면(패키지)의 전자결제 및 주문 처리</li>
              <li>이용자 간 소통(댓글, 좋아요)</li>
              <li>기타 회사가 정하는 업무</li>
            </ul>
          </li>
          <li>회사는 재화의 품절 또는 기술적 사양의 변경 등 부득이한 사정이 있는 경우, 장차 체결되는 계약에 의해 제공할 재화·용역의 내용을 변경할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제5조 (서비스 이용 시간)">
        서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다. 다만 시스템 점검, 통신 장애, 천재지변 등 운영상 필요한 경우 서비스 제공을 일시 중지할 수 있으며, 이 경우 사전 또는 사후에 공지합니다.
      </Section>

      <Section title="제6조 (회원 가입 및 비회원 구매)">
        <ol className="list-decimal pl-5">
          <li>이용자는 회원 가입 없이도 쇼핑몰에서 재화를 구매할 수 있습니다. 이 경우 이용자가 입력한 이름·전화번호·배송지·주문번호를 통해 주문조회 및 배송이 처리됩니다.</li>
          <li>회원 가입을 원하는 이용자는 회사가 정한 소셜 로그인(Google 등) 절차를 통해 가입할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제7조 (구매 및 결제)">
        <ol className="list-decimal pl-5">
          <li>이용자는 쇼핑몰에 게시된 패키지 또는 FilmCutting 에서 생성한 본인 도면을 장바구니에 담아 결제를 진행할 수 있습니다.</li>
          <li>결제 수단은 카카오페이·네이버페이·구글페이 등 회사가 지정한 간편결제이며, 결제 대행은 ㈜아임포트(포트원)를 통해 처리됩니다.</li>
          <li>이용자가 결제 시 입력한 정보는 본 쇼핑몰 및 결제 대행사의 약관에 따라 처리됩니다.</li>
        </ol>
      </Section>

      <Section title="제8조 (재화의 공급)">
        <ol className="list-decimal pl-5">
          <li>회사는 이용자와 재화의 공급시기에 관하여 별도의 약정이 없는 한, 이용자가 청약을 한 날로부터 영업일 기준 7일 이내에 재화를 배송할 수 있도록 주문제작·발송 등 기타의 필요한 조치를 합니다.</li>
          <li>회사는 이용자가 구매한 재화에 대해 배송 수단, 배송 비용, 배송 기간 등을 명시합니다.</li>
        </ol>
      </Section>

      <Section title="제9조 (청약철회 및 환불)">
        청약철회 및 환불에 관한 사항은 별도의{' '}
        <a href="/legal/refund" className="underline">환불·취소 정책</a>
        에 따릅니다.
      </Section>

      <Section title="제10조 (게시물의 관리)">
        <ol className="list-decimal pl-5">
          <li>이용자가 쇼핑몰에 게시한 작품·댓글 등의 저작권은 해당 이용자에게 귀속됩니다. 단, 회사는 서비스 제공·홍보 목적의 범위 내에서 이를 노출·재가공할 수 있는 비독점적 이용권을 갖습니다.</li>
          <li>외부 링크(블로그·SNS·동영상 등)를 공유한 경우, 본문 텍스트는 매 요청 시 원본에서 실시간으로 불러오며 회사 서버에 저장하지 않습니다. 외부 콘텐츠의 저작권은 원작자에게 있습니다.</li>
          <li>타인의 권리를 침해하거나 법령에 위반되는 게시물은 사전 통지 없이 삭제될 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제11조 (개인정보의 보호)">
        회사는 이용자의 개인정보를 본 쇼핑몰의{' '}
        <a href="/legal/privacy" className="underline">개인정보처리방침</a>
        에 따라 보호하며, 관련 법령이 정하는 바에 따라 안전하게 관리합니다.
      </Section>

      <Section title="제12조 (회사의 의무)">
        회사는 법령과 본 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 본 약관이 정하는 바에 따라 지속적이고 안정적으로 재화·용역을 제공하기 위해 최선을 다합니다.
      </Section>

      <Section title="제13조 (이용자의 의무)">
        <ol className="list-decimal pl-5">
          <li>이용자는 신청 또는 변경 시 허위의 내용을 등록하지 않아야 합니다.</li>
          <li>이용자는 타인의 정보 도용, 결제 정보의 부정 사용, 회사 게시 정보의 변경, 회사가 정한 정보 외의 정보 송신·게시, 회사 기타 제3자의 저작권 등 지식재산권에 대한 침해 등의 행위를 해서는 안 됩니다.</li>
        </ol>
      </Section>

      <Section title="제14조 (분쟁 해결)">
        <ol className="list-decimal pl-5">
          <li>회사와 이용자 간 발생한 분쟁은 우선 상호 협의를 통해 해결합니다.</li>
          <li>협의가 이루어지지 않을 경우, 「소비자기본법」에 따른 소비자분쟁조정위원회의 조정에 따를 수 있습니다.</li>
          <li>본 약관에 관한 소송은 민사소송법상의 관할 법원에 제기합니다.</li>
        </ol>
      </Section>

      <Section title="문의처">
        <ul className="list-none pl-0">
          <li>운영자: {COMPANY}</li>
          <li>이메일: <a href={`mailto:${EMAIL}`} className="underline">{EMAIL}</a></li>
          <li>전화: {TEL}</li>
        </ul>
      </Section>

      <p className="mt-12 text-xs text-ink-45">본 약관은 {EFFECTIVE}부터 시행합니다.</p>
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
