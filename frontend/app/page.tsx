import Link from 'next/link';
import { ArrowRight, Clock, Brain, Target, Mail, Shield, Zap, ChevronRight, CheckCircle2, TrendingUp, Users, Star } from 'lucide-react';

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="mx-auto max-w-4xl text-center">
            {/* Trust Badge */}
            <div className="mb-6 inline-flex items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              <Zap className="mr-2 h-4 w-4" />
              Save 3+ hours every week on AI newsletters
            </div>
            
            {/* Main Headline */}
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
              Turn Your AI Newsletter Chaos Into
              <span className="block text-blue-600">One Actionable Weekly Digest</span>
            </h1>
            
            {/* Sub-headline */}
            <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600 sm:text-xl">
              Stop drowning in 50+ AI newsletters. Get intelligent summaries with role-specific insights 
              and product opportunities delivered to your inbox every Sunday.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors"
              >
                Start Your Free Week
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-lg border-2 border-gray-300 px-8 py-4 text-lg font-semibold text-gray-700 hover:border-gray-400 transition-colors"
              >
                See How It Works
                <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
            
            {/* Social Proof */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                <span>Join 500+ professionals saving time weekly</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-400" />
                <span>2-minute setup</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Agitation */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              74% of Professionals Feel Overwhelmed by Newsletter Fatigue
            </h2>
            <p className="text-lg text-gray-600">
              You subscribe to stay informed about AI, but end up with 100+ unread newsletters. 
              Important insights get buried. Opportunities slip by. Your inbox becomes a source of anxiety, not knowledge.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                From Chaos to Clarity in 3 Simple Steps
              </h2>
              <p className="text-lg text-gray-600">
                Set it up once, save hours every week
              </p>
            </div>
            
            <div className="space-y-8">
              {/* Step 1 */}
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Connect Your Gmail in 2 Minutes
                  </h3>
                  <p className="text-gray-600">
                    Secure OAuth connection. We only read AI/tech newsletters, nothing else.
                  </p>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Our AI Analyzes & Extracts Key Insights
                  </h3>
                  <p className="text-gray-600">
                    GPT-4 reads every newsletter, fact-checks with web search, and identifies what matters for your role.
                  </p>
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Get Your Personalized Digest Every Sunday
                  </h3>
                  <p className="text-gray-600">
                    Beautiful email with summaries, role-specific advice, and product opportunities. Read in 10 minutes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Features That Actually Save You Time
              </h2>
              <p className="text-lg text-gray-600">
                Not just another aggregator – intelligent analysis that delivers value
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  AI-Powered Analysis
                </h3>
                <p className="text-gray-600">
                  GPT-4 doesn&apos;t just summarize – it identifies trends, validates claims, and surfaces what matters.
                </p>
              </div>
              
              {/* Feature 2 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Role-Specific Insights
                </h3>
                <p className="text-gray-600">
                  Get actionable advice tailored to your role – developer, founder, product manager, or investor.
                </p>
              </div>
              
              {/* Feature 3 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Product Opportunities
                </h3>
                <p className="text-gray-600">
                  Discover specific features and products you could build based on emerging AI trends.
                </p>
              </div>
              
              {/* Feature 4 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Beautiful Email Digests
                </h3>
                <p className="text-gray-600">
                  Professional, scannable emails that are a joy to read. Not another wall of text.
                </p>
              </div>
              
              {/* Feature 5 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Cost Control Built-In
                </h3>
                <p className="text-gray-600">
                  Hard limits on API usage. Never worry about runaway costs. Typically $0.10 per digest.
                </p>
              </div>
              
              {/* Feature 6 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Weekly Schedule
                </h3>
                <p className="text-gray-600">
                  Delivered every Sunday at 8 AM. Start your week informed, not overwhelmed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits/Results */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                What You&apos;ll Get Every Week
              </h2>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 md:p-12">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900">Executive Summary:</span>
                    <span className="text-gray-700"> The week&apos;s most important AI developments in 3 paragraphs</span>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900">Key Articles:</span>
                    <span className="text-gray-700"> 10-15 must-read pieces with smart summaries</span>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900">Role-Specific Advice:</span>
                    <span className="text-gray-700"> Actionable tips for your specific job function</span>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900">Product Ideas:</span>
                    <span className="text-gray-700"> 3-5 opportunities you could build this week</span>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900">Critical Take:</span>
                    <span className="text-gray-700"> Honest analysis of hype vs. reality</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-white/70 rounded-lg">
                <p className="text-sm text-gray-600 italic">
                  &ldquo;AI Digest turned my newsletter anxiety into excitement. I actually look forward to Sundays now.&rdquo;
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-2">
                  – Sarah Chen, Product Manager at a YC Startup
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-gray-600">
                Start free. Upgrade when you see the value.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="text-4xl font-bold text-gray-900">$5</span>
                  <span className="text-gray-600">/month</span>
                </div>
                
                <p className="text-gray-600 mb-8">
                  Less than the cost of one coffee. Save 3+ hours every week.
                </p>
                
                <div className="space-y-3 text-left mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Weekly AI digest emails</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Unlimited newsletters processed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Role-specific insights</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Product opportunity alerts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Digest history access</span>
                  </div>
                </div>
                
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center w-full rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors"
                >
                  Start Your Free Week
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                
                <p className="text-sm text-gray-500 mt-4">
                  No credit card required. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Frequently Asked Questions
              </h2>
            </div>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How secure is my Gmail connection?
                </h3>
                <p className="text-gray-600">
                  We use OAuth 2.0 for secure authentication. We can only read emails, not send or delete them. 
                  Your credentials are never stored, and you can revoke access anytime from your Google account.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Which newsletters do you process?
                </h3>
                <p className="text-gray-600">
                  We intelligently identify and process AI, tech, and innovation newsletters. This includes publications 
                  like The Neuron, TLDR, Benedict Evans, Stratechery, and 100+ others. Non-tech emails are ignored.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Can I customize the delivery schedule?
                </h3>
                <p className="text-gray-600">
                  Currently, digests are sent every Sunday at 8 AM. Custom schedules (daily, bi-weekly) are coming soon 
                  based on user feedback.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  What if I&apos;m not satisfied?
                </h3>
                <p className="text-gray-600">
                  Try it free for a week. If you&apos;re not saving hours and feeling more informed, simply don&apos;t subscribe. 
                  No tricks, no hassle.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How is this different from Unroll.Me or SaneBox?
                </h3>
                <p className="text-gray-600">
                  Those tools just organize emails. We actually read, analyze, and synthesize content using GPT-4. 
                  You get insights and recommendations, not just a list of links.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Reclaim Your Sunday Mornings?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Join 500+ professionals who&apos;ve turned newsletter chaos into competitive advantage.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-lg font-semibold text-blue-600 shadow-lg hover:bg-gray-50 transition-colors"
            >
              Start Your Free Week Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <p className="text-sm text-blue-100 mt-4">
              Setup takes 2 minutes. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-400">
            <p>&copy; 2024 AI Digest. Built by indie developers who read too many newsletters.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
