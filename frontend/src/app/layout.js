import "./globals.css";
import Navbar from "../components/Navbar";

export const metadata = {
    title: "Give'n'Take",
    description: "AI agent for freelancers: fair deals, secure PayPal payments",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                <Navbar />
                <div className="container">{children}</div>
            </body>
        </html>
    );
}
