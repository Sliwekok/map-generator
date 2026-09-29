import Navbar, { Footer } from "@/components/Navbar";
import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <>
      <Navbar />
      <main>
        <AuthForm mode="register" />
      </main>
      <Footer />
    </>
  );
}
