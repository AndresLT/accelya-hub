import { LoginForm } from "./LoginForm";
import { LoginNotice } from "./LoginNotice";

/**
 * Login route (UC1). This is a Server Component: it renders no
 * interactive logic itself, it only lays out the page and delegates the
 * OTP flow to <LoginForm />, which runs in the browser.
 *
 * The middleware already redirects an authenticated, in-window user away
 * from here to the Hub, so this page is only ever seen while logged out.
 * When the middleware signs someone out it appends `?reason=...`, which
 * <LoginNotice /> turns into an explanatory toast.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <LoginNotice reason={reason} />
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-bg-3 bg-bg-1 shadow-sm">
        <header className="bg-acc-blue px-6 py-5">
          <p className="font-heading text-lg font-bold tracking-tight text-tx-1-c">
            accelya <span className="text-acc-teal">&gt;&gt;</span> Hub
          </p>
        </header>
        <div className="px-6 py-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
