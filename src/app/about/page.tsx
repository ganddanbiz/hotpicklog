import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "소개",
  description: "득템로그가 어떤 글을, 어떤 기준으로 쓰는지 안내합니다.",
};

export default function AboutPage() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "득템로그";
  return (
    <>
      <SiteHeader />
      <main className="dt-article-wrap">
        <article className="dt-article dt-page">
          <p className="dt-eyebrow"><span>About</span></p>
          <h1 className="dt-article__title">{siteName} 소개</h1>
          <p className="dt-article__lead">잘 고르고, 기분 좋게 득템하다.</p>

          <div className="prose">
            <h2>어떤 글을 쓰나요</h2>
            <p>
              생활·주방, 가전, 식품, 패션, 뷰티처럼 매일 쓰는 물건을 다룹니다.
              글은 두 가지로 나뉩니다.
            </p>
            <ul>
              <li><strong>상품 소개</strong> — 눈에 띄는 상품 하나를 골라 특징과 장단점, 어울리는 사람을 정리한 글</li>
              <li><strong>구매 가이드</strong> — 특정 상품이 아니라 “무엇을 기준으로 골라야 하는지”를 정리한 글</li>
            </ul>

            <h2>어떻게 만드나요</h2>
            <p>
              글은 AI 도구의 도움을 받아 초안을 만들고, 공개 전에 사실 확인 검수를 거칩니다.
              확인할 수 없는 수치나 근거 없는 “1위·최고” 같은 표현은 쓰지 않으려고 합니다.
              가격·재고·할인율은 자주 바뀌기 때문에 글에 적지 않으며, 구매 전 판매 페이지에서 확인해 주세요.
            </p>
            <p>틀린 내용을 발견하시면 문의하기로 알려 주세요. 확인 후 고치고 수정일을 표시합니다.</p>

            <h2 id="affiliate">제휴 안내</h2>
            <p>
              이 블로그는 쿠팡 파트너스 활동의 일환으로, 글 속 링크를 통한 구매에 대해 일정액의 수수료를 제공받습니다.
              링크로 구매하셔도 구매자가 내는 가격은 같습니다. 제휴 링크가 있는 글은 본문 위에 따로 안내합니다.
            </p>
          </div>
        </article>
      </main>
    </>
  );
}
