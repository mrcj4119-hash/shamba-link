import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, Clock3, CreditCard, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { ApiError, api } from "./api";
import { useAuth } from "./auth";

export interface PhotoPaymentStatus {
  amountKes: number;
  recipientPhone: string;
  status: "not_submitted" | "initiating" | "pending" | "approved" | "rejected";
  receiptCode: string | null;
  createdAt: string | null;
  resultDescription: string | null;
}

interface PaymentReviewRequest {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerEmail: string;
  farmerPhone: string;
  receiptCode: string;
  amountKes: number;
  status: "pending";
  createdAt: string;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "We couldn't reach Shamba Link. Check your connection and try again.";
}

export function usePhotoPaymentAccess() {
  const { token, user } = useAuth();
  return useQuery({
    queryKey: ["photo-payment-status", token?.slice(-8)],
    queryFn: () => api<{ data: PhotoPaymentStatus }>("/api/photo-payments/status", {}, token),
    enabled: Boolean(token) && user?.role === "farmer",
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
    refetchInterval: (query) => query.state.data?.data.status === "pending" ? 15000 : false,
  });
}

export function usePaymentReviewerCapability() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["payment-reviewer-capability", token?.slice(-8)],
    queryFn: () => api<{ data: { canReview: boolean } }>("/api/admin/photo-payments/capability", {}, token),
    enabled: Boolean(token),
  });
}

export function PhotoPaymentGate({ access }: { access: ReturnType<typeof usePhotoPaymentAccess> }) {
  const { token } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const submitReceipt = useMutation({
    mutationFn: (receiptCode: string) => api<{ data: PhotoPaymentStatus }>("/api/photo-payments/request", {
      method: "POST",
      body: JSON.stringify({ receiptCode }),
    }, token),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["photo-payment-status"] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const receiptCode = String(new FormData(form).get("receiptCode") ?? "").trim().toUpperCase();
    submitReceipt.mutate(receiptCode);
    form.reset();
  }

  const payment = access.data?.data;
  return <section className="photo-payment-card" aria-live="polite">
    <div className="photo-payment-heading"><span className="photo-payment-icon"><CreditCard size={18} /></span><div><span className="form-kicker">AI FEEDBACK PAYMENT</span><h2>KSh 10 before AI feedback · manual M-Pesa</h2></div></div>
    {access.isLoading && <p className="photo-payment-message"><Clock3 size={16} /> Checking this session's payment status…</p>}
    {access.isError && <p className="form-error" role="alert">{errorMessage(access.error)}</p>}
    {payment?.status === "approved" && <p className="photo-payment-message payment-approved"><CheckCircle2 size={17} /> Payment verified. Crop and animal AI feedback is unlocked for this sign-in session.</p>}
    {payment?.status === "pending" && payment.receiptCode && <p className="photo-payment-message"><Clock3 size={17} /> Receipt {payment.receiptCode} is awaiting administrator verification. This page checks for approval automatically.</p>}
    {payment?.status === "pending" && !payment.receiptCode && <p className="photo-payment-message"><Clock3 size={17} /> This session has an older automatic-payment request. Sign out and back in to start a new Send Money receipt request.</p>}
    {payment?.status === "rejected" && <p className="photo-payment-message payment-rejected"><XCircle size={17} /> {payment.resultDescription ?? "The submitted receipt was not approved. Check the transfer and submit its correct receipt code."}</p>}
    {(payment?.status === "not_submitted" || payment?.status === "rejected") && <p className="photo-payment-instructions">Send <strong>KSh {payment.amountKes}</strong> using M-Pesa <strong>Send Money</strong> to <strong>{payment.recipientPhone}</strong>. After the transfer, enter the receipt code from the M-Pesa confirmation SMS. An administrator must verify the transfer before feedback is enabled.</p>}
    {(payment?.status === "not_submitted" || payment?.status === "rejected") && <form className="photo-payment-form" onSubmit={submit}>
      <label>M-Pesa receipt code<input name="receiptCode" autoComplete="off" required minLength={8} maxLength={12} pattern="[A-Za-z0-9]{8,12}" placeholder="e.g. QWE7RTYUIO" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark" disabled={submitReceipt.isPending || access.isLoading || !payment}>
        {submitReceipt.isPending ? "Submitting receipt…" : "Submit receipt for verification"}
      </button>
    </form>}
    {payment?.status === "pending" && payment.receiptCode && <p className="photo-payment-note"><ShieldCheck size={15} /> Receipt codes are checked against the recipient’s M-Pesa transaction record.</p>}
    {payment && payment.status !== "approved" && <button className="photo-payment-refresh" type="button" onClick={() => void access.refetch()} disabled={access.isFetching}><RefreshCw size={14} /> Refresh payment status</button>}
    {!payment && !access.isLoading && !access.isError && <p className="photo-payment-message"><CircleHelp size={16} /> Payment status is unavailable. Please refresh and try again.</p>}
  </section>;
}

export function PhotoPaymentReviewPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const requests = useQuery({
    queryKey: ["photo-payment-review-queue"],
    queryFn: () => api<{ data: PaymentReviewRequest[] }>("/api/admin/photo-payments", {}, token),
    enabled: Boolean(token),
  });
  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      api(`/api/admin/photo-payments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }, token),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["photo-payment-review-queue"] });
      await client.invalidateQueries({ queryKey: ["photo-payment-status"] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  return <div className="page-stack">
    <div className="page-heading"><div><div className="form-kicker">PAYMENT ADMINISTRATION</div><h1>Verify M-Pesa receipts</h1><p>Check that each KSh 10 Send Money transfer was received at the configured mobile number before approving or rejecting its receipt.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {requests.isError && <p className="form-error" role="alert">{errorMessage(requests.error)}</p>}
    {requests.isLoading && <p className="photo-payment-message"><Clock3 size={16} /> Loading receipt requests…</p>}
    {!requests.isLoading && !requests.isError && requests.data?.data.length === 0 && <div className="content-card photo-payment-empty">There are no receipts waiting for review.</div>}
    {requests.data?.data.map((request) => <article className="content-card payment-review-row" key={request.id}>
      <div><div className="form-kicker">KSh {request.amountKes} · {new Date(request.createdAt).toLocaleString("en-KE")}</div><h2>{request.farmerName}</h2><p>{request.farmerEmail} · {request.farmerPhone}</p><strong className="payment-review-code">{request.receiptCode}</strong></div>
      <div className="payment-review-actions">
        <button className="button button-dark" disabled={review.isPending} onClick={() => review.mutate({ id: request.id, status: "approved" })}>Approve</button>
        <button className="button button-soft" disabled={review.isPending} onClick={() => review.mutate({ id: request.id, status: "rejected" })}>Reject</button>
      </div>
    </article>)}
  </div>;
}
