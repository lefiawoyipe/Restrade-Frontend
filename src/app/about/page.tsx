import Link from "next/link";
import {
  PublicFooter,
  PublicHeader,
  TradingSteps,
} from "../components/PublicLayout";
import { Icon } from "../components/UI";
export default function About() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="public-page">
        <section className="about-intro">
          <div className="eyebrow">About ResTrade</div>
          <h1>
            Good things.
            <br />
            One campus. <span>More possibilities.</span>
          </h1>
          <p>
            Student life comes with enough expenses. ResTrade helps useful
            things find a new owner, with a clearer way to buy and sell within
            your campus community.
          </p>
        </section>
        <TradingSteps />
        <div className="grid-two about-details">
          <section className="panel">
            <h2>Trust should be easy to understand.</h2>
            <p className="muted about-explainer">
              Escrow helps you control when payment reaches the seller. It does
              not replace checking an item or reading the listing carefully.
            </p>
            <details open>
              <summary>When does the seller receive payment?</summary>
              <p>
                After you receive and inspect the item, confirm receipt in
                Orders. That action releases the held funds to the seller.
              </p>
            </details>
            <details>
              <summary>What if the item is not as described?</summary>
              <p>
                Use “Report a problem” on your active order before confirming
                receipt. Explain what happened and add evidence to your case.
                Payment remains held while an administrator reviews the dispute.
              </p>
            </details>
            <details>
              <summary>What does a seller’s rating mean?</summary>
              <p>
                Ratings summarize reviews from completed trades. A new seller
                has “No reviews yet”, rather than a misleading zero-star rating.
                A rating is useful feedback, not a guarantee.
              </p>
            </details>
          </section>
          <section className="panel wallet">
            <div className="eyebrow">Built around campus life</div>
            <h2>
              Trade thoughtfully.
              <br />
              Keep useful things going.
            </h2>
            <p className="muted about-explainer">
              Be clear about condition. Agree on a sensible public collection
              point. Check the item together. Leave an honest review.
            </p>
            <Link className="btn lime" href="/marketplace">
              Find your next essential <Icon name="arrow" />
            </Link>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
