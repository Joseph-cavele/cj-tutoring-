import Hero from "@/components/home/Hero";
import TrustBar from "@/components/home/TrustBar";
import PromiseSection from "@/components/home/PromiseSection";
import SubjectsSection from "@/components/home/SubjectsSection";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import LearningFormats from "@/components/home/LearningFormats";
import Testimonials from "@/components/home/Testimonials";
import ContactSection from "@/components/home/ContactSection";

export default function Home() {
  // Full landing page order from Design.md section 7.
  return (
    <>
      <Hero />
      <TrustBar />
      <PromiseSection />
      <SubjectsSection />
      <WhyChooseUs />
      <LearningFormats />
      <Testimonials />
      <ContactSection />
    </>
  );
}
