import { auth } from "@/server/auth";
import { bank } from "@/server/bank";
import { chain } from "@/server/chain";
import { handle, json, readJson, requireRole, HttpError } from "@/server/http";
import { PaymentAttemptSchema } from "@/shared/contract";
export const dynamic = "force-dynamic";
/** merchant capability: submit an execution attempt. The attempt is untrusted; rails enforce the approved facts. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireRole(req, "merchant");
    const { id } = await ctx.params;
    const attempt = PaymentAttemptSchema.parse({ ...(await readJson(req)), agreementId: id });
    const view = auth.get(id);
    if (!view) throw new HttpError("NOT_FOUND", "no such agreement", 404);
    if (view.agreement.rail === "bank") {
      const out = bank.execute(view, attempt);
      return json({ ...out, view: auth.get(id) }, out.decision.accepted ? 200 : 409);
    }
    const out = await chain.executeProtected(view, attempt);
    const updated = auth.recordOutcome(id, out);
    return json({ ...out, view: updated }, out.decision.accepted ? 200 : 409);
  });
}
