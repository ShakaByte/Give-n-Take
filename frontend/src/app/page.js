import Link from "next/link";

export default function Home() {
    return (
        <div>
            <section className="hero">
                <h1 className="hero-title">
                    Get a fair deal. Get paid for your work.
                </h1>
                <p className="hero-text">
                    Give&apos;n&apos;Take is an AI agent for freelancers. It
                    builds a fair price and pitch for every client, then locks
                    your final file until PayPal confirms the payment.
                </p>
                <div className="hero-actions">
                    <Link href="/deal-maker" className="btn">
                        Start a deal
                    </Link>
                    <Link href="/deals" className="btn-outline">
                        View my deals
                    </Link>
                </div>
            </section>

            <section className="home-section">
                <h2 className="home-heading">What it does</h2>
                <div className="grid-3">
                    <div className="feature">
                        <div className="feature-title">Deal Maker</div>
                        <p className="feature-text">
                            AI agents read the client&apos;s brief, extract the
                            scope, set a fair price for both sides, and write
                            your pitch. New to freelancing? Learning mode
                            explains what to ask and what to avoid.
                        </p>
                    </div>
                    <div className="feature">
                        <div className="feature-title">AI Assistance</div>
                        <p className="feature-text">
                            Turns your deadline and to-do list into a dated
                            plan, with alerts when a task looks too big or the
                            schedule gets tight.
                        </p>
                    </div>
                    <div className="feature">
                        <div className="feature-title">Payment Lock</div>
                        <p className="feature-text">
                            The client pays a deposit, reviews a preview, then
                            pays the rest. The final file unlocks automatically
                            once PayPal confirms the payment.
                        </p>
                    </div>
                </div>
            </section>

            <section className="home-section">
                <h2 className="home-heading">How it works</h2>
                <ol className="steps">
                    <li>
                        <span className="step-num">1</span>
                        <span>
                            Paste the client&apos;s message or attach their PDF
                            brief.
                        </span>
                    </li>
                    <li>
                        <span className="step-num">2</span>
                        <span>
                            Review the AI price and pitch, then accept the deal.
                        </span>
                    </li>
                    <li>
                        <span className="step-num">3</span>
                        <span>
                            The client pays a 50% deposit by PayPal link or QR
                            code.
                        </span>
                    </li>
                    <li>
                        <span className="step-num">4</span>
                        <span>
                            You upload the work. The client sees a preview only.
                        </span>
                    </li>
                    <li>
                        <span className="step-num">5</span>
                        <span>
                            The client pays the remaining 50% and the file
                            unlocks.
                        </span>
                    </li>
                </ol>
            </section>
        </div>
    );
}
