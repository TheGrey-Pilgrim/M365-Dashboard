// ─── src/useGraphData.js ──────────────────────────────────────────────────────
// Hook React centralisé pour tous les appels Graph API
// Retourne { data, loading, error } pour chaque endpoint
//
// Stratégie : données réelles si disponibles, fallback sur fictives sinon
// Permet de tester sans bloquer l'affichage en cas d'erreur API
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";

// ── Utilitaire fetch avec retry sur 429 ───────────────────────────────────────
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const wait = parseInt(res.headers.get("Retry-After") || "5", 10) * 1000;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return res.json();
  }
  throw new Error(`Max retries reached for ${url}`);
}

// ── Hook générique ────────────────────────────────────────────────────────────
export function useGraphEndpoint(endpoint, fallback = null) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    setError(null);

    const url = `/api/graph?endpoint=${encodeURIComponent(endpoint)}`;
    fetchWithRetry(url)
      .then(d => {
        if (isMounted.current) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn(`[Graph API] ${endpoint}:`, err.message);
        if (isMounted.current) {
          setData(fallback);   // utiliser les données fictives en fallback
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { isMounted.current = false; };
  }, [endpoint]);

  return { data, loading, error };
}

// ── Transformation : subscribedSkus → format licencesByPlan ──────────────────
// Mappe les SKUs Microsoft vers les noms courts du dashboard
// Référence : https://learn.microsoft.com/en-us/azure/active-directory/enterprise-users/licensing-service-plan-reference
const SKU_MAP = {
  // SKU part numbers → noms courts dashboard
  "SPE_E5":               { plan: "Microsoft 365 E5",    coutUnitaire: 57, couleur: "#DC2626" },
  "SPE_E3":               { plan: "Microsoft 365 E3",    coutUnitaire: 36, couleur: "#4F46E5" },
  "ENTERPRISEPREMIUM":    { plan: "Microsoft 365 E3",    coutUnitaire: 36, couleur: "#4F46E5" }, // O365 E3
  "ENTERPRISEPACK":       { plan: "Microsoft 365 E3",    coutUnitaire: 36, couleur: "#4F46E5" },
  "O365_BUSINESS_PREMIUM":{ plan: "Microsoft 365 Business Premium", coutUnitaire: 22, couleur: "#7C3AED" },
  "SPB":                  { plan: "Microsoft 365 Business Premium", coutUnitaire: 22, couleur: "#7C3AED" },
  "STANDARDPACK":         { plan: "Microsoft 365 E1",    coutUnitaire: 8,  couleur: "#C4B5FD" },
  "SPE_E1":               { plan: "Microsoft 365 E1",    coutUnitaire: 8,  couleur: "#C4B5FD" },
  "DEVELOPERPACK_E5":     { plan: "Microsoft 365 E5 Dev",coutUnitaire: 0,  couleur: "#94A3B8" },
  "FLOW_FREE":            { plan: "Power Automate Free", coutUnitaire: 0,  couleur: "#94A3B8" },
};

export function transformSkusToLicences(skus) {
  if (!skus || !Array.isArray(skus)) return [];

  const grouped = {};

  skus.forEach(sku => {
    // Ignorer les SKUs gratuits ou de dev sans unités réelles
    if (sku.appliesTo !== "User") return;
    if (sku.prepaidUnits?.enabled === 0) return;

    const partNumber = sku.skuPartNumber;
    const mapped = SKU_MAP[partNumber];

    const planName = mapped?.plan || sku.skuPartNumber;
    const couleur  = mapped?.couleur || "#6B7280";
    const coutUnit = mapped?.coutUnitaire || 0;

    const acquises  = sku.prepaidUnits?.enabled || 0;
    const assignees = sku.consumedUnits || 0;

    if (!grouped[planName]) {
      grouped[planName] = { plan: planName, acquises: 0, assignees: 0, actives: 0, coutUnitaire: coutUnit, couleur };
    }
    grouped[planName].acquises  += acquises;
    grouped[planName].assignees += assignees;
    // "actives" non disponible via subscribedSkus — utiliser assignées comme proxy
    // Les rapports d'adoption donneront les chiffres réels
    grouped[planName].actives   += Math.round(assignees * 0.88); // estimation jusqu'à màj via rapports
  });

  return Object.values(grouped)
    .filter(l => l.acquises > 0)
    .sort((a, b) => b.acquises - a.acquises);
}

// ── Transformation : users Graph → scorecard ─────────────────────────────────
export function transformUsersToScorecard(users) {
  if (!users || !Array.isArray(users)) return null;

  const total          = users.length;
  const actifs         = users.filter(u => u.accountEnabled).length;
  const bloques        = users.filter(u => !u.accountEnabled).length;
  const sansLicence    = users.filter(u => !u.assignedLicenses?.length).length;
  const doubleLicence  = users.filter(u => (u.assignedLicenses?.length || 0) > 1).length;

  return {
    licencesAssignees: total - sansLicence,
    comptesActifs:     actifs,
    comptesInactifs:   0, // nécessite AuditLog — à compléter avec getSignInActivity
    comptesBloqués:    bloques,
    licencesSansEMS:   sansLicence,
    doubleAssignation: doubleLicence,
    economieEstimee:   0, // calculé après analyse downgrade
  };
}

// ── Transformation : rapport CSV activité → adoptionByWorkload ────────────────
// Prend le résultat d'un rapport d'adoption et retourne actifs + taux
export function transformReportToAdoption(reportData, workloadName, totalAssignes) {
  if (!reportData?.value || !Array.isArray(reportData.value)) {
    return { workload: workloadName, actifs: 0, taux: 0 };
  }

  // Un utilisateur est "actif" s'il a au moins une activité dans la période
  const rows = reportData.value;
  const actifs = rows.filter(row => {
    // Les colonnes varient selon le rapport — on cherche la présence d'activité
    const vals = Object.values(row);
    return vals.some(v => {
      const n = parseInt(v, 10);
      return !isNaN(n) && n > 0;
    });
  }).length;

  const taux = totalAssignes > 0 ? Math.round(actifs / totalAssignes * 100) : 0;
  return { workload: workloadName, actifs, taux };
}

// ── Transformation : users Graph → profileUsers dashboard ────────────────────
export function transformUsersToProfiles(users) {
  if (!users || !Array.isArray(users)) return [];

  return users.slice(0, 50).map(u => { // limiter à 50 pour la démo
    const licences    = u.assignedLicenses || [];
    const planReel    = licences[0] ? licences[0].skuId : "Aucune";
    const actif       = u.accountEnabled;
    const stockageOD  = 0; // nécessite endpoint séparé /drives
    const mailboxSize = 0; // nécessite endpoint séparé mailbox usage

    return {
      prenom:           (u.displayName || "").split(" ")[0] || "—",
      nom:              (u.displayName || "").split(" ").slice(1).join(" ") || "—",
      email:            u.mail || u.userPrincipalName || "—",
      region:           u.officeLocation || "—",
      entite:           u.companyName || "—",
      segment:          u.department || "—",
      planTheorique:    "—",
      planReel:         planReel,
      statut:           actif ? "ok" : "bloqué",
      stockageOD,
      mailboxSize,
      archiveSize:      0,
      actifTeams:       false,
      actifSP:          false,
      copilot:          false,
      eligibleDowngrade:false,
      downgradeVers:    null,
      raisonDowngrade:  "Analyse en cours",
      coutPlan:         0,
    };
  });
}

// ── Hook composite : charge toutes les données du dashboard ───────────────────
// Retourne un objet avec toutes les sources et leur état
export function useDashboardData() {
  const skus    = useGraphEndpoint("subscribedSkus");
  const users   = useGraphEndpoint(
    "users?$select=id,displayName,mail,userPrincipalName,accountEnabled,assignedLicenses,department,companyName,officeLocation&$top=999"
  );

  // Rapports d'adoption (30 jours)
  const rptEmail = useGraphEndpoint("reports/getEmailActivityUserDetail(period='D30')");
  const rptTeams = useGraphEndpoint("reports/getTeamsUserActivityUserDetail(period='D30')");
  const rptSP    = useGraphEndpoint("reports/getSharePointActivityUserDetail(period='D30')");
  const rptOD    = useGraphEndpoint("reports/getOneDriveActivityUserDetail(period='D30')");

  // État de chargement global
  const loading = skus.loading || users.loading;
  const hasErrors = [skus, users, rptEmail, rptTeams, rptSP, rptOD].some(r => r.error);

  // Données transformées
  const licencesByPlan = skus.data
    ? transformSkusToLicences(skus.data.value)
    : null;

  const scorecard = users.data
    ? transformUsersToScorecard(users.data.value)
    : null;

  const totalAssignes = scorecard?.licencesAssignees || 1;

  const adoptionByWorkload = [
    transformReportToAdoption(rptEmail.data, "Exchange",   totalAssignes),
    transformReportToAdoption(rptTeams.data, "Teams",      totalAssignes),
    transformReportToAdoption(rptSP.data,    "SharePoint", totalAssignes),
    transformReportToAdoption(rptOD.data,    "OneDrive",   totalAssignes),
  ].filter(r => r.actifs > 0 || !loading);

  const profileUsers = users.data
    ? transformUsersToProfiles(users.data.value)
    : null;

  return {
    loading,
    hasErrors,
    errors: {
      skus:     skus.error,
      users:    users.error,
      rptEmail: rptEmail.error,
      rptTeams: rptTeams.error,
    },
    // Données réelles (null si pas encore chargées)
    licencesByPlan,
    scorecard,
    adoptionByWorkload,
    profileUsers,
    // Données brutes pour debug
    raw: { skus: skus.data, users: users.data },
  };
}
