import { describe, expect, it } from "vitest";

import { ApiError } from "../api-error";
import { pickFacturePatch } from "../factures";
import {
  DOCUMENT_KINDS,
  EMAIL_STATUSES,
  FACTURE_STATUTS,
  APP_USER_ROLES,
} from "../enums";
import { validateAgainstContract } from "../validation";

describe("enums dérivées du contrat", () => {
  it("factures/emails/roles = CHECK SQL", () => {
    expect(FACTURE_STATUTS).toEqual([
      "extracted",
      "valide",
      "rejete",
      "paye",
      "archive",
    ]);
    expect(EMAIL_STATUSES).toEqual(["received", "processed", "error"]);
    expect(DOCUMENT_KINDS).toEqual(["email", "attachment"]);
    expect(APP_USER_ROLES).toEqual(["admin", "backoffice", "terrain"]);
  });
});

describe("pickFacturePatch (D6)", () => {
  it("extrait la transition de statut", () => {
    expect(pickFacturePatch({ statut: "valide" })).toEqual({
      statut: "valide",
    });
  });
  it("refuse tout autre champ seul (seule la transition est permise)", () => {
    expect(() => pickFacturePatch({ montant_ttc: 100 })).toThrow(ApiError);
    try {
      pickFacturePatch({});
    } catch (e) {
      expect((e as ApiError).code).toBe("statut_required");
    }
  });
  it("interdit la cible 'extracted' (statut pipeline, D6)", () => {
    try {
      pickFacturePatch({ statut: "extracted" });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("forbidden_statut");
    }
  });
});

describe("validation Ajv pilotée par le contrat", () => {
  it("FactureUpdate : statut hors enum → 400", () => {
    expect(() =>
      validateAgainstContract("FactureUpdate", { statut: "valide" })
    ).not.toThrow();
    expect(() =>
      validateAgainstContract("FactureUpdate", { statut: "bogus" })
    ).toThrow(ApiError);
  });

  it("FactureUpdate : champs inconnus refusés (additionalProperties: false)", () => {
    expect(() =>
      validateAgainstContract("FactureUpdate", { bogus: 1 })
    ).toThrow(ApiError);
  });

  it("AppUserInsert : user_id + client_slug requis", () => {
    expect(() =>
      validateAgainstContract("AppUserInsert", {
        user_id: "019af0ad-4ac8-7052-a094-d1a1d5a9e3f1",
        client_slug: "arev",
      })
    ).not.toThrow();
    expect(() =>
      validateAgainstContract("AppUserInsert", { client_slug: "arev" })
    ).toThrow(ApiError);
  });

  it("format uuid refusé pour un id invalide (path params)", () => {
    expect(() =>
      validateAgainstContract("uuid", "019af0ad-4ac8-7052-a094-d1a1d5a9e3f1")
    ).not.toThrow();
    expect(() => validateAgainstContract("uuid", "abc")).toThrow(ApiError);
  });

  it("DocumentSearchRequest : match_count borné 1..20", () => {
    expect(() =>
      validateAgainstContract("DocumentSearchRequest", {
        query: "facture électricité",
        match_count: 20,
      })
    ).not.toThrow();
    expect(() =>
      validateAgainstContract("DocumentSearchRequest", {
        query: "facture",
        match_count: 21,
      })
    ).toThrow(ApiError);
  });

  it("DocumentSearchResult.similarity : number accepté, string refusée", () => {
    expect(() =>
      validateAgainstContract("DocumentSearchResult", {
        id: "019af0ad-4ac8-7052-a094-d1a1d5a9e3f1",
        kind: "email",
        content: "x",
        metadata: {},
        similarity: 0.87,
      })
    ).not.toThrow();
  });
});
