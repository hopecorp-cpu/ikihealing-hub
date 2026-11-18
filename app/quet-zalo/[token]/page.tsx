import QuetClient from "./QuetClient";

export const dynamic = "force-dynamic";

export default function QuetPage({ params }: { params: { token: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <QuetClient token={params.token} />
    </div>
  );
}
