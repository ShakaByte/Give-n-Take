import Link from "next/link";

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <Link href="/" className="brand">
                    Give&apos;n&apos;Take
                </Link>
                <div className="nav-links">
                    <Link href="/">Home</Link>
                    <Link href="/deal-maker">Deal Maker</Link>
                    <Link href="/profile">Profile</Link>
                </div>
            </div>
        </nav>
    );
}
