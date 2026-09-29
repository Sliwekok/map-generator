import Navbar, { Footer } from "@/components/Navbar";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main>
        <AuthForm mode="login" />
      </main>
      <Footer />
    </>
  );
}
