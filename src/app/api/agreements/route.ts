import { auth } from "@/server/auth";
import { chain } from "@/server/chain";
import { handle, json, readJson, requireRole, HttpError } from "@/server/http";
import { AgreementDraftSchema } from "@/shared/contract";
export const dynamic = "force-dynamic";
/** merchant capability: propose an agreement. Does NOT return any approval capability. */
export async function POST(req: Request) {
  return handle(async () => {
    requireRole(req, "merchant");
    const draft = AgreementDraftSchema.parse(await readJson(req));
    let domain = null;
    if (draft.rail === "crypto") {
      const b = await chain.binding();
      if (!b) throw new HttpError("RAIL_UNAVAILABLE", "local chain unavailable", 503);
      domain = { chainId: b.chainId, verifyingContract: b.verifyingContract, token: b.token, payer: b.payer };
    }
    return json(auth.createAgreement(draft, domain), 201);
  });
}
export async function GET() { return handle(() => json({ agreements: auth.list() })); }
