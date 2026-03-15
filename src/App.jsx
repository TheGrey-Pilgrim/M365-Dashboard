import { useState, useMemo, useEffect } from "react";
import { useDashboardData } from "./useGraphData.js";

const USER_ROLE = "admin"; 

const DATA = {
  periods: ["Jan 2025", "Fév 2025", "Mar 2025", "Avr 2025", "Mai 2025"],
  regions: ["Toutes", "France", "EMEA", "APAC", "Americas"],
  entities: ["Toutes", "Holding SA", "France SAS", "UK Ltd", "DE GmbH"],
  segments: ["Tous", "Finance", "RH", "Opérations", "IT", "Commercial"],

  scorecard: {
    licencesAssignees: 1087,
    comptesActifs: 934,
    comptesInactifs: 153,
    comptesBloqués: 12,
    licencesSansEMS: 34,
    doubleAssignation: 7,
    economieEstimee: 47800,
  },

  adoptionCriteres: {
    "Exchange":    { base: "Au moins 1 email envoyé ou reçu sur 30j (Graph API getEmailActivityUserDetail)", modifie: false },
    "Teams":       { base: "Au moins 1 message posté ou réunion rejointe sur 30j (getTeamsUserActivityUserDetail)", modifie: false },
    "SharePoint":  { base: "Au moins 1 fichier consulté, modifié ou partagé sur 30j", modifie: true, modifieNote: "Critère élargi : inclut la navigation sur les sites SP (vs MS qui ne compte que les fichiers)" },
    "OneDrive":    { base: "Au moins 1 fichier synchronisé ou consulté sur 30j", modifie: false },
    "Power BI":    { base: "Au moins 1 rapport consulté ou dashboard ouvert sur 30j", modifie: false },
    "Copilot M365":{ base: "Au moins 1 interaction Copilot (chat, résumé, génération) sur 30j", modifie: true, modifieNote: "Critère personnalisé : exclut les suggestions passives de l'IDE" },
  },

  adoptionByWorkload: [
    { workload: "Exchange",    actifs: 912, taux: 98 },
    { workload: "Teams",       actifs: 834, taux: 89 },
    { workload: "SharePoint",  actifs: 541, taux: 58 },
    { workload: "OneDrive",    actifs: 498, taux: 53 },
    { workload: "Power BI",    actifs: 187, taux: 20 },
    { workload: "Copilot M365",actifs: 98,  taux: 11 },
  ],

  licencesByPlan: [
    { plan: "E3",           acquises: 850, assignees: 762, actives: 681, coutUnitaire: 36, couleur: "#4F46E5" },
    { plan: "E1 + M365 Apps",acquises: 210, assignees: 198, actives: 174, coutUnitaire: 28, couleur: "#7C3AED" },
    { plan: "MF1",          acquises: 120, assignees: 89,  actives: 62,  coutUnitaire: 8,  couleur: "#A78BFA" },
    { plan: "E1",           acquises: 60,  assignees: 38,  actives: 17,  coutUnitaire: 8,  couleur: "#C4B5FD" },
  ],

  trend: [
    { mois: "Jan", acquises: 1220, assignees: 1050, engagement: 1180 },
    { mois: "Fév", acquises: 1220, assignees: 1062, engagement: 1185 },
    { mois: "Mar", acquises: 1230, assignees: 1071, engagement: 1190 },
    { mois: "Avr", acquises: 1230, assignees: 987,  engagement: 1195 },
    { mois: "Mai", acquises: 1240, assignees: 1087, engagement: 1200 },
    { mois: "Jun", acquises: null, assignees: null,  engagement: 1205 },
    { mois: "Jul", acquises: null, assignees: null,  engagement: 1205 },
    { mois: "Aoû", acquises: null, assignees: null,  engagement: 1210 },
    { mois: "Sep", acquises: null, assignees: null,  engagement: 1215 },
    { mois: "Oct", acquises: null, assignees: null,  engagement: 1220 },
    { mois: "Nov", acquises: null, assignees: null,  engagement: 1225 },
    { mois: "Déc", acquises: null, assignees: null,  engagement: 1230 },
  ],

  contrat: {
    type: "Enterprise Agreement (EA)",
    dateDebut: "01/07/2024", dateFin: "30/06/2027",
    renouvellementDans: 27, partenaire: "SoftwareOne",
    plans: [
      { plan: "E3",            acquises: 850, coutUnitaire: 36, coutAnnuel: 850*36*12, engagement: "Fixe",         upgrade: true,  downgrade: false },
      { plan: "E1 + M365 Apps",acquises: 210, coutUnitaire: 28, coutAnnuel: 210*28*12, engagement: "Flexible +/-10%",upgrade: true, downgrade: true  },
      { plan: "MF1",           acquises: 120, coutUnitaire: 8,  coutAnnuel: 120*8*12,  engagement: "Flexible",     upgrade: true,  downgrade: true  },
      { plan: "E1",            acquises: 60,  coutUnitaire: 8,  coutAnnuel: 60*8*12,   engagement: "Fixe",         upgrade: false, downgrade: false },
    ],
  },

  profiles: [
    { nom: "Admin",          count: 42,  couleur: "#DC2626", plan: "Microsoft 365 E5", regions: { France: 18, EMEA: 12, APAC: 6, Americas: 6 },   segments: { IT: 30, Finance: 8, Opérations: 4 } },
    { nom: "Full",           count: 412, couleur: "#4F46E5", plan: "Microsoft 365 E3", regions: { France: 180, EMEA: 120, APAC: 62, Americas: 50 }, segments: { Finance: 140, IT: 90, Commercial: 110, Opérations: 72 } },
    { nom: "Full Optimized", count: 298, couleur: "#7C3AED", plan: "Microsoft 365 E1 + Microsoft 365 Apps for Enterprise", regions: { France: 100, EMEA: 98, APAC: 60, Americas: 40 }, segments: { Finance: 80, RH: 70, Opérations: 90, Commercial: 58 } },
    { nom: "Online",         count: 335, couleur: "#C4B5FD", plan: "Microsoft 365 E1", regions: { France: 132, EMEA: 80, APAC: 65, Americas: 58 }, segments: { Finance: 80, RH: 100, IT: 90, Commercial: 65 } },
  ],

  profileUsers: [
    { prenom: "Sophie", nom: "Martin",  email: "s.martin@acme.com",  region: "France",   entite: "Holding SA",  segment: "Finance",    planTheorique: "Microsoft 365 E3",  planReel: "Microsoft 365 E3 + Microsoft 365 F3", statut: "double",  stockageOD: 4.2,   mailboxSize: 8.1,  archiveSize: 2.4,  actifTeams: true,  actifSP: true,  copilot: false, eligibleDowngrade: true,  downgradeVers: "Microsoft 365 E1 + Microsoft 365 Apps for Enterprise", raisonDowngrade: "Double plan F3 non justifié · boite+archive < 48 Go · OD < 1 To", coutPlan: 36 },
    { prenom: "Thomas", nom: "Berger",  email: "t.berger@acme.com",  region: "EMEA",     entite: "DE GmbH",     segment: "Opérations", planTheorique: "Microsoft 365 E3",  planReel: "Microsoft 365 E3",                   statut: "inactif", stockageOD: 0.3,   mailboxSize: 1.2,  archiveSize: 0.4,  actifTeams: false, actifSP: false, copilot: false, eligibleDowngrade: true,  downgradeVers: "Microsoft 365 E1 + Microsoft 365 Apps for Enterprise", raisonDowngrade: "Inactif 90j+ · boite+archive 1,6 Go < 48 Go · OD 0,3 Go < 1 To",  coutPlan: 36 },
    { prenom: "Laura",  nom: "Petit",   email: "l.petit@acme.com",   region: "France",   entite: "France SAS",  segment: "RH",         planTheorique: "Microsoft 365 E1",  planReel: "Microsoft 365 E1",                   statut: "bloqué",  stockageOD: 0.1,   mailboxSize: 0.3,  archiveSize: 0.0,  actifTeams: false, actifSP: false, copilot: false, eligibleDowngrade: false, downgradeVers: null,                                                      raisonDowngrade: "Compte bloqué — à déprovisionner",                                  coutPlan: 8  },
    { prenom: "Marc",   nom: "Dupont",  email: "m.dupont@acme.com",  region: "France",   entite: "France SAS",  segment: "Finance",    planTheorique: "Microsoft 365 E3",  planReel: "Microsoft 365 E3",                   statut: "ok",      stockageOD: 18.4,  mailboxSize: 52.3, archiveSize: 18.7, actifTeams: true,  actifSP: true,  copilot: true,  eligibleDowngrade: false, downgradeVers: null,                                                      raisonDowngrade: "Usage complet justifié · boite+archive 71 Go > 48 Go",              coutPlan: 36 },
    { prenom: "Amina",  nom: "Diallo",  email: "a.diallo@acme.com",  region: "APAC",     entite: "UK Ltd",      segment: "Commercial", planTheorique: "Microsoft 365 E1",  planReel: "Microsoft 365 E3",                   statut: "ok",      stockageOD: 1.2,   mailboxSize: 6.4,  archiveSize: 1.1,  actifTeams: true,  actifSP: false, copilot: false, eligibleDowngrade: true,  downgradeVers: "Microsoft 365 E1 + Microsoft 365 Apps for Enterprise", raisonDowngrade: "Plan surdimensionné · profil terrain · boite+archive < 48 Go",       coutPlan: 36 },
    { prenom: "Julien", nom: "Roy",     email: "j.roy@acme.com",     region: "Americas", entite: "Holding SA",  segment: "IT",         planTheorique: "Microsoft 365 E3",  planReel: "Microsoft 365 E3",                   statut: "inactif", stockageOD: 0.8,   mailboxSize: 3.2,  archiveSize: 0.9,  actifTeams: false, actifSP: false, copilot: false, eligibleDowngrade: true,  downgradeVers: "Microsoft 365 E1 + Microsoft 365 Apps for Enterprise", raisonDowngrade: "Inactif 90j · boite+archive 4,1 Go < 48 Go · OD 0,8 Go < 1 To",    coutPlan: 36 },
    { prenom: "Hélène", nom: "Moreau",  email: "h.moreau@acme.com",  region: "France",   entite: "Holding SA",  segment: "IT",         planTheorique: "Microsoft 365 E5",  planReel: "Microsoft 365 E5",                   statut: "ok",      stockageOD: 45.0,  mailboxSize: 98.0, archiveSize: 40.0, actifTeams: true,  actifSP: true,  copilot: true,  eligibleDowngrade: false, downgradeVers: null,                                                      raisonDowngrade: "Admin · profil sécurité justifié",                                  coutPlan: 57 },
  ],

  coutParPlan: {
    "Microsoft 365 E5": 57,
    "Microsoft 365 E3": 36,
    "Microsoft 365 E1 + Microsoft 365 Apps for Enterprise": 28,
    "Microsoft 365 E1": 8,
    "Microsoft 365 F3": 8,
  },

  licencesByPlanByEntity: {
    "Toutes":      [
      { plan: "E3",            acquises: 850, assignees: 762, actives: 681, coutUnitaire: 36, couleur: "#4F46E5" },
      { plan: "E1 + M365 Apps",acquises: 210, assignees: 198, actives: 174, coutUnitaire: 28, couleur: "#7C3AED" },
      { plan: "MF1",           acquises: 120, assignees: 89,  actives: 62,  coutUnitaire: 8,  couleur: "#A78BFA" },
      { plan: "E1",            acquises: 60,  assignees: 38,  actives: 17,  coutUnitaire: 8,  couleur: "#C4B5FD" },
    ],
    "Holding SA":  [
      { plan: "E3",            acquises: 340, assignees: 312, actives: 280, coutUnitaire: 36, couleur: "#4F46E5" },
      { plan: "E1 + M365 Apps",acquises: 80,  assignees: 74,  actives: 66,  coutUnitaire: 28, couleur: "#7C3AED" },
      { plan: "MF1",           acquises: 40,  assignees: 28,  actives: 18,  coutUnitaire: 8,  couleur: "#A78BFA" },
      { plan: "E1",            acquises: 20,  assignees: 12,  actives: 5,   coutUnitaire: 8,  couleur: "#C4B5FD" },
    ],
    "France SAS":  [
      { plan: "E3",            acquises: 210, assignees: 188, actives: 167, coutUnitaire: 36, couleur: "#4F46E5" },
      { plan: "E1 + M365 Apps",acquises: 60,  assignees: 58,  actives: 50,  coutUnitaire: 28, couleur: "#7C3AED" },
      { plan: "MF1",           acquises: 35,  assignees: 26,  actives: 18,  coutUnitaire: 8,  couleur: "#A78BFA" },
      { plan: "E1",            acquises: 15,  assignees: 10,  actives: 4,   coutUnitaire: 8,  couleur: "#C4B5FD" },
    ],
    "UK Ltd":      [
      { plan: "E3",            acquises: 180, assignees: 158, actives: 140, coutUnitaire: 36, couleur: "#4F46E5" },
      { plan: "E1 + M365 Apps",acquises: 45,  assignees: 40,  actives: 36,  coutUnitaire: 28, couleur: "#7C3AED" },
      { plan: "MF1",           acquises: 28,  assignees: 22,  actives: 16,  coutUnitaire: 8,  couleur: "#A78BFA" },
      { plan: "E1",            acquises: 15,  assignees: 10,  actives: 6,   coutUnitaire: 8,  couleur: "#C4B5FD" },
    ],
    "DE GmbH":     [
      { plan: "E3",            acquises: 120, assignees: 104, actives: 94,  coutUnitaire: 36, couleur: "#4F46E5" },
      { plan: "E1 + M365 Apps",acquises: 25,  assignees: 26,  actives: 22,  coutUnitaire: 28, couleur: "#7C3AED" },
      { plan: "MF1",           acquises: 17,  assignees: 13,  actives: 10,  coutUnitaire: 8,  couleur: "#A78BFA" },
      { plan: "E1",            acquises: 10,  assignees: 6,   actives: 2,   coutUnitaire: 8,  couleur: "#C4B5FD" },
    ],
  },

  groupeDataByEntity: {
    "Toutes": {
      regions:  [{ r: "France", l: 412, a: 378 }, { r: "EMEA",     l: 298, a: 241 }, { r: "APAC",    l: 187, a: 134 }, { r: "Americas", l: 190, a: 181 }],
      segments: [{ s: "Finance", l: 260, a: 238 }, { s: "Opérations", l: 212, a: 171 }, { s: "Commercial", l: 245, a: 198 }, { s: "IT", l: 190, a: 181 }, { s: "RH", l: 180, a: 146 }],
    },
    "Holding SA": {
      regions:  [{ r: "France", l: 180, a: 166 }, { r: "Americas",  l: 100, a: 96  }, { r: "EMEA",    l: 80,  a: 64  }, { r: "APAC",     l: 60,  a: 50  }],
      segments: [{ s: "Finance", l: 140, a: 130 }, { s: "IT", l: 100, a: 96  }, { s: "Commercial", l: 80,  a: 66  }, { s: "RH", l: 60,  a: 50  }, { s: "Opérations", l: 40, a: 32 }],
    },
    "France SAS": {
      regions:  [{ r: "France", l: 320, a: 294 }],
      segments: [{ s: "Finance", l: 100, a: 92  }, { s: "RH", l: 80,  a: 70  }, { s: "Opérations", l: 70,  a: 62  }, { s: "IT", l: 50,  a: 46  }, { s: "Commercial", l: 20, a: 24  }],
    },
    "UK Ltd":  {
      regions:  [{ r: "EMEA", l: 148, a: 122 }, { r: "APAC", l: 80, a: 62 }, { r: "Americas", l: 40, a: 38 }],
      segments: [{ s: "Commercial", l: 100, a: 82  }, { s: "Finance", l: 80,  a: 68  }, { s: "IT", l: 48,  a: 40  }, { s: "Opérations", l: 40, a: 32 }],
    },
    "DE GmbH": {
      regions:  [{ r: "EMEA", l: 172, a: 140 }],
      segments: [{ s: "Opérations", l: 80, a: 64  }, { s: "IT", l: 52,  a: 44  }, { s: "RH", l: 40,  a: 32  }],
    },
  },

  trendByEntity: {
    "Toutes":     [
      { mois: "Jan", acquises: 1220, assignees: 1050, engagement: 1180 },
      { mois: "Fév", acquises: 1220, assignees: 1062, engagement: 1185 },
      { mois: "Mar", acquises: 1230, assignees: 1071, engagement: 1190 },
      { mois: "Avr", acquises: 1230, assignees: 987,  engagement: 1195 },
      { mois: "Mai", acquises: 1240, assignees: 1087, engagement: 1200 },
      { mois: "Jun", acquises: null, assignees: null,  engagement: 1205 },
      { mois: "Jul", acquises: null, assignees: null,  engagement: 1205 },
      { mois: "Aoû", acquises: null, assignees: null,  engagement: 1210 },
      { mois: "Sep", acquises: null, assignees: null,  engagement: 1215 },
      { mois: "Oct", acquises: null, assignees: null,  engagement: 1220 },
      { mois: "Nov", acquises: null, assignees: null,  engagement: 1225 },
      { mois: "Déc", acquises: null, assignees: null,  engagement: 1230 },
    ],
    "Holding SA": [
      { mois: "Jan", acquises: 470, assignees: 410, engagement: 455 },
      { mois: "Fév", acquises: 470, assignees: 418, engagement: 458 },
      { mois: "Mar", acquises: 480, assignees: 422, engagement: 461 },
      { mois: "Avr", acquises: 480, assignees: 390, engagement: 464 },
      { mois: "Mai", acquises: 480, assignees: 426, engagement: 467 },
      { mois: "Jun", acquises: null, assignees: null, engagement: 470 },
      { mois: "Jul", acquises: null, assignees: null, engagement: 470 },
      { mois: "Aoû", acquises: null, assignees: null, engagement: 472 },
      { mois: "Sep", acquises: null, assignees: null, engagement: 474 },
      { mois: "Oct", acquises: null, assignees: null, engagement: 476 },
      { mois: "Nov", acquises: null, assignees: null, engagement: 478 },
      { mois: "Déc", acquises: null, assignees: null, engagement: 480 },
    ],
    "France SAS": [
      { mois: "Jan", acquises: 310, assignees: 268, engagement: 300 },
      { mois: "Fév", acquises: 310, assignees: 274, engagement: 302 },
      { mois: "Mar", acquises: 320, assignees: 278, engagement: 304 },
      { mois: "Avr", acquises: 320, assignees: 250, engagement: 306 },
      { mois: "Mai", acquises: 320, assignees: 282, engagement: 308 },
      { mois: "Jun", acquises: null, assignees: null, engagement: 310 },
      { mois: "Jul", acquises: null, assignees: null, engagement: 310 },
      { mois: "Aoû", acquises: null, assignees: null, engagement: 312 },
      { mois: "Sep", acquises: null, assignees: null, engagement: 314 },
      { mois: "Oct", acquises: null, assignees: null, engagement: 316 },
      { mois: "Nov", acquises: null, assignees: null, engagement: 318 },
      { mois: "Déc", acquises: null, assignees: null, engagement: 320 },
    ],
    "UK Ltd":     [
      { mois: "Jan", acquises: 260, assignees: 222, engagement: 250 },
      { mois: "Fév", acquises: 260, assignees: 228, engagement: 252 },
      { mois: "Mar", acquises: 268, assignees: 230, engagement: 254 },
      { mois: "Avr", acquises: 268, assignees: 206, engagement: 256 },
      { mois: "Mai", acquises: 268, assignees: 224, engagement: 258 },
      { mois: "Jun", acquises: null, assignees: null, engagement: 260 },
      { mois: "Jul", acquises: null, assignees: null, engagement: 260 },
      { mois: "Aoû", acquises: null, assignees: null, engagement: 262 },
      { mois: "Sep", acquises: null, assignees: null, engagement: 264 },
      { mois: "Oct", acquises: null, assignees: null, engagement: 266 },
      { mois: "Nov", acquises: null, assignees: null, engagement: 268 },
      { mois: "Déc", acquises: null, assignees: null, engagement: 268 },
    ],
    "DE GmbH":    [
      { mois: "Jan", acquises: 180, assignees: 150, engagement: 174 },
      { mois: "Fév", acquises: 180, assignees: 142, engagement: 174 },
      { mois: "Mar", acquises: 162, assignees: 141, engagement: 171 },
      { mois: "Avr", acquises: 162, assignees: 141, engagement: 169 },
      { mois: "Mai", acquises: 172, assignees: 155, engagement: 167 },
      { mois: "Jun", acquises: null, assignees: null, engagement: 165 },
      { mois: "Jul", acquises: null, assignees: null, engagement: 165 },
      { mois: "Aoû", acquises: null, assignees: null, engagement: 166 },
      { mois: "Sep", acquises: null, assignees: null, engagement: 167 },
      { mois: "Oct", acquises: null, assignees: null, engagement: 168 },
      { mois: "Nov", acquises: null, assignees: null, engagement: 169 },
      { mois: "Déc", acquises: null, assignees: null, engagement: 170 },
    ],
  },

  allUsers: [
    {
      prenom: "Sophie", nom: "Martin", email: "s.martin@acme.com", fonction: "Responsable Finance",
      region: "France", segment: "Finance", entite: "Holding SA", ville: "Paris", pays: "France", hrClass: "Cadre",
      plan: "E3 + MF1",
      licenceFeatures: {
        "Exchange Online Plan 2": true, "Microsoft Teams": true, "SharePoint Online Plan 2": true,
        "OneDrive Entreprise Plan 2": true, "Microsoft 365 Apps": true, "Yammer / Viva Engage": true,
        "Power Apps for M365": true, "Power Automate for M365": true, "Power BI (free)": true,
        "Microsoft Forms": true, "Microsoft Planner": true, "Microsoft To Do": true,
        "Whiteboard": true, "Stream": true, "Bookings": false, "Viva Connections": true,
        "Viva Insights (perso)": true, "Intune": true, "Azure AD P1": true,
        "Defender for Office 365": false, "Microsoft Purview": false,
      },
      adoption: { mailsSent: 312, mailsRecu: 489, teamsChat: 87, reunions: 24, fichiersSP: 143, stockageOD: "4,2 Go" },
      adoptionScores: [
        { outil: "Exchange", score: 98, label: "Très actif" }, { outil: "Teams", score: 82, label: "Actif" },
        { outil: "SharePoint", score: 61, label: "Modéré" }, { outil: "OneDrive", score: 74, label: "Actif" },
        { outil: "Power BI", score: 12, label: "Faible" }, { outil: "Copilot M365", score: 91, label: "Très actif" },
      ],
      powerPlatform: { envs: ["Production", "Sandbox"], apps: ["Budget Tracker", "Expense Report", "HR Workflow"] },
      messagerie: { mailboxSize: "12,4 Go", archiveSize: "3,1 Go", litigation: false },
      copilot: {
        actif: true, interactionsTotal: 187, interactionsChat: 112, resumesGeneres: 43,
        emailsRediges: 22, documentsAnalyses: 10,
        agentsUtilises: ["Finance Assistant", "Budget Analyzer"],
        derniereUtilisation: "Il y a 2 jours", tempsEstimeEconomise: "3h / semaine",
      },
    },
    {
      prenom: "Marc", nom: "Dupont", email: "m.dupont@acme.com", fonction: "Chef de projet IT",
      region: "France", segment: "IT", entite: "France SAS", ville: "Lyon", pays: "France", hrClass: "Cadre",
      plan: "E3",
      licenceFeatures: {
        "Exchange Online Plan 2": true, "Microsoft Teams": true, "SharePoint Online Plan 2": true,
        "OneDrive Entreprise Plan 2": true, "Microsoft 365 Apps": true, "Yammer / Viva Engage": false,
        "Power Apps for M365": true, "Power Automate for M365": true, "Power BI (free)": true,
        "Microsoft Forms": true, "Microsoft Planner": true, "Microsoft To Do": true,
        "Whiteboard": true, "Stream": false, "Bookings": false, "Viva Connections": false,
        "Viva Insights (perso)": true, "Intune": true, "Azure AD P1": true,
        "Defender for Office 365": false, "Microsoft Purview": false,
      },
      adoption: { mailsSent: 198, mailsRecu: 301, teamsChat: 210, reunions: 41, fichiersSP: 88, stockageOD: "18,4 Go" },
      adoptionScores: [
        { outil: "Exchange", score: 77, label: "Actif" }, { outil: "Teams", score: 95, label: "Très actif" },
        { outil: "SharePoint", score: 43, label: "Faible" }, { outil: "OneDrive", score: 88, label: "Très actif" },
        { outil: "Power BI", score: 55, label: "Modéré" }, { outil: "Copilot M365", score: 20, label: "Faible" },
      ],
      powerPlatform: { envs: ["Production"], apps: ["IT Asset Tracker"] },
      messagerie: { mailboxSize: "8,2 Go", archiveSize: "1,0 Go", litigation: false },
      copilot: { actif: false, interactionsTotal: 0, interactionsChat: 0, resumesGeneres: 0, emailsRediges: 0, documentsAnalyses: 0, agentsUtilises: [], derniereUtilisation: "Jamais", tempsEstimeEconomise: "—" },
    },
  ],
};

const fmt   = (n) => typeof n === "number" ? n.toLocaleString("fr-FR") : n;
const fmtEur= (n) => `${fmt(Math.round(n))} €`;
const tc    = (t) => t >= 80 ? "#10B981" : t >= 60 ? "#F59E0B" : "#EF4444";

function downloadCSV(data, filename) {
  const headers = Object.keys(data[0]).join(";");
  const rows = data.map(r => Object.values(r).join(";")).join("\n");
  const blob = new Blob([headers + "\n" + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
}

function KpiCard({ label, value, sub, color = "#4F46E5", alert = false }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", border: `1px solid ${alert ? "#FEE2E2" : "#EEF0F6"}`, borderLeft: `4px solid ${alert ? "#EF4444" : color}`, flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: alert ? "#EF4444" : "#0F172A", fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Tag({ children, color = "#4F46E5" }) {
  return <span style={{ fontSize: 11, fontWeight: 600, background: color + "20", color, padding: "2px 8px", borderRadius: 6 }}>{children}</span>;
}

function StatusBadge({ statut }) {
  const m = { ok: ["Actif","#DCFCE7","#16A34A"], inactif: ["Inactif","#FEF9C3","#CA8A04"], bloqué: ["Bloqué","#FEE2E2","#DC2626"], double: ["Double plan","#EDE9FE","#7C3AED"] };
  const [l,bg,c] = m[statut] || m.ok;
  return <span style={{ fontSize: 11, fontWeight: 600, background: bg, color: c, padding: "2px 10px", borderRadius: 20 }}>{l}</span>;
}

const SCORECARD_BY_ENTITY = {
  "Toutes":     { licencesAssignees: 1087, comptesActifs: 934, comptesInactifs: 153, comptesBloqués: 12, licencesSansEMS: 34, doubleAssignation: 7, economieEstimee: 47800 },
  "Holding SA": { licencesAssignees: 426,  comptesActifs: 380, comptesInactifs: 46,  comptesBloqués: 4,  licencesSansEMS: 12, doubleAssignation: 2, economieEstimee: 18200 },
  "France SAS": { licencesAssignees: 282,  comptesActifs: 252, comptesInactifs: 30,  comptesBloqués: 3,  licencesSansEMS: 8,  doubleAssignation: 2, economieEstimee: 12400 },
  "UK Ltd":     { licencesAssignees: 230,  comptesActifs: 188, comptesInactifs: 42,  comptesBloqués: 3,  licencesSansEMS: 9,  doubleAssignation: 2, economieEstimee: 10200 },
  "DE GmbH":    { licencesAssignees: 149,  comptesActifs: 114, comptesInactifs: 35,  comptesBloqués: 2,  licencesSansEMS: 5,  doubleAssignation: 1, economieEstimee: 7000  },
};
const ADOPTION_BY_ENTITY = {
  "Toutes":     [{ workload:"Exchange",actifs:912,taux:98},{ workload:"Teams",actifs:834,taux:89},{ workload:"SharePoint",actifs:541,taux:58},{ workload:"OneDrive",actifs:498,taux:53},{ workload:"Power BI",actifs:187,taux:20},{ workload:"Copilot M365",actifs:98,taux:11}],
  "Holding SA": [{ workload:"Exchange",actifs:372,taux:97},{ workload:"Teams",actifs:334,taux:87},{ workload:"SharePoint",actifs:218,taux:57},{ workload:"OneDrive",actifs:194,taux:51},{ workload:"Power BI",actifs:84, taux:22},{ workload:"Copilot M365",actifs:46,taux:12}],
  "France SAS": [{ workload:"Exchange",actifs:248,taux:99},{ workload:"Teams",actifs:228,taux:91},{ workload:"SharePoint",actifs:149,taux:59},{ workload:"OneDrive",actifs:138,taux:55},{ workload:"Power BI",actifs:52, taux:21},{ workload:"Copilot M365",actifs:28,taux:11}],
  "UK Ltd":     [{ workload:"Exchange",actifs:178,taux:97},{ workload:"Teams",actifs:156,taux:85},{ workload:"SharePoint",actifs:98, taux:53},{ workload:"OneDrive",actifs:90, taux:49},{ workload:"Power BI",actifs:32, taux:17},{ workload:"Copilot M365",actifs:14,taux:8 }],
  "DE GmbH":    [{ workload:"Exchange",actifs:114,taux:99},{ workload:"Teams",actifs:116,taux:87},{ workload:"SharePoint",actifs:76, taux:66},{ workload:"OneDrive",actifs:76, taux:58},{ workload:"Power BI",actifs:19, taux:17},{ workload:"Copilot M365",actifs:10,taux:10}],
};

function Scorecard({ filters, setGlossaire, liveData }) {
  const sc = liveData?.scorecard || (SCORECARD_BY_ENTITY[filters.entity] || SCORECARD_BY_ENTITY["Toutes"]);
  const workloads = liveData?.adoptionByWorkload?.length
    ? liveData.adoptionByWorkload
    : (ADOPTION_BY_ENTITY[filters.entity] || ADOPTION_BY_ENTITY["Toutes"]);
  const eco = Math.round((sc.economieEstimee || 0) / 12);
  const maxA = Math.max(...workloads.map(w => w.actifs), 1);
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Scorecard · {filters.period}</h2>
        <p style={{ color: "#64748B", fontSize: 13, margin: "4px 0 0" }}>Vue synthétique · Tous périmètres</p>
      </div>

      {}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 160px", gridTemplateRows: "auto auto", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Licences assignées"  value={fmt(sc.licencesAssignees)} sub="Stock actif" />
        <KpiCard label="Comptes actifs 30j"  value={fmt(sc.comptesActifs)}    sub={`${Math.round((sc.comptesActifs||0)/(sc.licencesAssignees||1)*100)}% des assignés`} color="#10B981" />
        <KpiCard label="Comptes inactifs"    value={fmt(sc.comptesInactifs)}  sub=">90j sans connexion" color="#F59E0B" alert />
        {}
        <div style={{ gridRow: "1 / 3", background: "linear-gradient(160deg,#4F46E5,#7C3AED)", borderRadius: 14, padding: "20px 18px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", color: "#fff" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C7D2FE", marginBottom: 8 }}>Économie estimée</div>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "monospace", lineHeight: 1 }}>{fmtEur(eco)}</div>
          <div style={{ fontSize: 11, color: "#A5B4FC", marginTop: 6 }}>/ mois</div>
          <div style={{ marginTop: 12, fontSize: 10, color: "#C7D2FE", lineHeight: 1.5 }}>Potentiel annuel<br /><strong style={{ color: "#fff" }}>{fmtEur(sc.economieEstimee || 0)}</strong></div>
        </div>
        <KpiCard label="Comptes bloqués"     value={fmt(sc.comptesBloqués)}   sub="Licence encore assignée" color="#EF4444" alert />
        <KpiCard label="Sans EMS"            value={fmt(sc.licencesSansEMS)}  sub="Non-conformité sécu" color="#EF4444" alert />
        <KpiCard label="Double assignation"  value={fmt(sc.doubleAssignation)}sub="Plans en conflit" color="#7C3AED" alert />
      </div>

      {}
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #EEF0F6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Adoption par workload · 30 jours</h3>
            <p style={{ color: "#94A3B8", fontSize: 12, margin: "4px 0 0" }}>Utilisateurs actifs / Licences assignées</p>
          </div>
          <button onClick={() => setGlossaire(true)} style={{ fontSize: 11, color: "#4F46E5", background: "#EEF2FF", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}>📖 Critères d'adoption</button>
        </div>
        {workloads.map(w => {
          const pct = Math.round(w.actifs / maxA * 100);
          const c = tc(w.taux);
          const modifie = DATA.adoptionCriteres[w.workload]?.modifie;
          return (
            <div key={w.workload} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{w.workload}</span>
                  {modifie && <span style={{ fontSize: 10, background: "#FEF9C3", color: "#92400E", padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>critère modifié</span>}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#64748B" }}>{fmt(w.actifs)} utilisateurs</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c, background: c + "18", padding: "2px 8px", borderRadius: 20 }}>{w.taux}%</span>
                </div>
              </div>
              <div style={{ background: "#F1F5F9", borderRadius: 4, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, background: c, height: "100%", borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Licences({ filters, liveData }) {
  const [sel, setSel] = useState("Tous");
  const allPlans = liveData?.licencesByPlan?.length
    ? liveData.licencesByPlan
    : (DATA.licencesByPlanByEntity[filters.entity] || DATA.licencesByPlanByEntity["Toutes"]);
  const fp = sel === "Tous" ? allPlans : allPlans.filter(p => p.plan === sel);

  const acquises  = fp.reduce((s,p)=>s+p.acquises,0);
  const assignees = fp.reduce((s,p)=>s+p.assignees,0);
  const actives   = fp.reduce((s,p)=>s+p.actives,0);
  const dispo     = acquises - assignees;

  const trendBase = DATA.trendByEntity[filters.entity] || DATA.trendByEntity["Toutes"];
  const allPlansForRatio = DATA.licencesByPlanByEntity[filters.entity] || DATA.licencesByPlanByEntity["Toutes"];
  const totalAllAcq = allPlansForRatio.reduce((s,p)=>s+p.acquises,0);
  const selAcqForTrend = sel === "Tous" ? totalAllAcq : (allPlansForRatio.find(p=>p.plan===sel)?.acquises || totalAllAcq);
  const trendRatio = totalAllAcq > 0 ? selAcqForTrend / totalAllAcq : 1;
  const trend = trendBase.map(d => ({
    ...d,
    acquises:   d.acquises  ? Math.round(d.acquises  * trendRatio) : null,
    assignees:  d.assignees ? Math.round(d.assignees * trendRatio) : null,
    engagement: Math.round(d.engagement * trendRatio),
  }));

  const H = 160;
  const PAD_L = 50; 
  const maxVal = Math.max(...trend.map(d => Math.max(d.acquises||0, d.engagement||0))) * 1.12;
  const toH = (v) => v ? Math.round((v / maxVal) * H) : 0;
  const toY = (v) => H - Math.round((v / maxVal) * H);
  const ySteps = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  const nCols = trend.length;
  const colW = 1 / nCols;
  const engPoints = trend.map((d, i) => `${(i + 0.5) * 100 / nCols},${toY(d.engagement)}`).join(" ");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Licence Monitoring · {filters.period}</h2>
          <p style={{ color: "#64748B", fontSize: 13, margin: "4px 0 0" }}>
            {filters.entity !== "Toutes" ? `${filters.entity} · ` : ""}Suivi mensuel par plan · Stock vs Engagement
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {["Tous", ...allPlans.map(p => p.plan)].map(p => (
            <button key={p} onClick={() => setSel(p)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: sel === p ? "#4F46E5" : "#F1F5F9", color: sel === p ? "#fff" : "#64748B" }}>{p}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Acquises"    value={fmt(acquises)}  color="#4F46E5" />
        <KpiCard label="Assignées"   value={fmt(assignees)} sub={`${Math.round(assignees/acquises*100)}% du stock`} color="#7C3AED" />
        <KpiCard label="Actives 30j" value={fmt(actives)}   sub={`${Math.round(actives/acquises*100)}% du stock`}  color="#10B981" />
        <KpiCard label="Disponibles" value={fmt(dispo)}     sub="Non assignées" color="#F59E0B" alert={dispo>50} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {}
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #EEF0F6" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Total assigné vs stock</h3>
          {}
          <div style={{ display: "flex", gap: 14, fontSize: 11, marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: "#4F46E5", borderRadius: 2, display: "inline-block" }} /> Actives</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: "#A78BFA", borderRadius: 2, display: "inline-block" }} /> Assignées</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 2, display: "inline-block" }} /> Disponibles</span>
          </div>

          {fp.map(l => {
            const pAct  = Math.round(l.actives   / l.acquises * 100);
            const pAss  = Math.round(l.assignees / l.acquises * 100);
            const pDispo= 100 - pAss;
            return (
              <div key={l.plan} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: l.couleur }}>{l.plan}</span>
                  <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                    <span style={{ color: "#4F46E5", fontWeight: 600 }}>{pAct}% actives</span>
                    <span style={{ color: "#7C3AED" }}>{pAss}% assignées</span>
                    <span style={{ color: "#10B981" }}>{pDispo}% dispo</span>
                  </div>
                </div>
                {}
                <div style={{ display: "flex", height: 18, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pAct}%`,   background: "#4F46E5",         transition: "width 0.4s" }} />
                  <div style={{ width: `${pAss - pAct}%`, background: "#A78BFA",    transition: "width 0.4s" }} />
                  <div style={{ width: `${pDispo}%`, background: "#DCFCE7", border: "1px solid #BBF7D0", transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: "#94A3B8" }}>
                  <span>{fmt(l.actives)} actives · {fmt(l.assignees)} assignées · {fmt(l.acquises - l.assignees)} dispo</span>
                  <span>{fmt(l.acquises)} total</span>
                </div>
              </div>
            );
          })}
        </div>

        {}
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #EEF0F6" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Tendance mensuelle · Licences & engagement</h3>

          {}
          <div style={{ display: "flex", gap: 0 }}>
            {}
            <div style={{ width: PAD_L, flexShrink: 0, display: "flex", flexDirection: "column-reverse", justifyContent: "space-between", height: H + 20, paddingBottom: 20 }}>
              {ySteps.map((v, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, height: 0, position: "relative" }}>
                  <span style={{ fontSize: 8, color: "#CBD5E1", fontFamily: "monospace", whiteSpace: "nowrap" }}>{fmt(v)}</span>
                </div>
              ))}
            </div>

            {}
            <div style={{ flex: 1, position: "relative", height: H + 20 }}>
              {}
              <svg viewBox={`0 0 100 ${H}`} style={{ position: "absolute", bottom: 20, left: 0, right: 0, width: "100%", height: H, pointerEvents: "none" }} preserveAspectRatio="none">
                {ySteps.slice(1).map((v, i) => (
                  <line key={i} x1="0" x2="100" y1={toY(v)} y2={toY(v)} stroke="#F1F5F9" strokeWidth="0.5" />
                ))}
              </svg>

              {}
              <div style={{ display: "flex", alignItems: "flex-end", height: H, position: "absolute", bottom: 20, left: 0, right: 0 }}>
                {trend.map((d, i) => {
                  const isFutur = d.acquises === null;
                  const hAcq = toH(d.acquises);
                  const hAss = toH(d.assignees);
                  const rPrev = trend[i-1];
                  const baisse = !isFutur && rPrev && rPrev.assignees && d.assignees < rPrev.assignees;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: H }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 1, width: "80%" }}>
                        <div style={{ flex: 1, height: isFutur ? 3 : hAcq, background: isFutur ? "#E2E8F0" : "#4F46E5", borderRadius: "2px 2px 0 0", opacity: isFutur ? 0.4 : 1 }} />
                        <div style={{ flex: 1, height: isFutur ? 3 : hAss, background: isFutur ? "#E2E8F0" : baisse ? "#F97316" : "#7C3AED", borderRadius: "2px 2px 0 0", opacity: isFutur ? 0.4 : 1 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {}
              <svg viewBox={`0 0 100 ${H}`} style={{ position: "absolute", bottom: 20, left: 0, right: 0, width: "100%", height: H, pointerEvents: "none", overflow: "visible" }} preserveAspectRatio="none">
                <polyline points={engPoints} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
                {trend.map((d, i) => (
                  <circle key={i} cx={(i + 0.5) * 100 / nCols} cy={toY(d.engagement)} r="1.5" fill="#10B981" opacity={d.acquises === null ? 0.4 : 1} />
                ))}
              </svg>

              {}
              <div style={{ display: "flex", position: "absolute", bottom: 0, left: 0, right: 0 }}>
                {trend.map((d, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#94A3B8" }}>{d.mois}</div>
                ))}
              </div>
            </div>
          </div>

          {}
          <div style={{ display: "flex", gap: 16, fontSize: 11, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "#4F46E5", borderRadius: 2, display: "inline-block" }} /> Acquises</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "#7C3AED", borderRadius: 2, display: "inline-block" }} /> Assignées</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="20" height="10" viewBox="0 0 20 10" style={{ display: "inline-block" }}><polyline points="0,5 20,5" stroke="#10B981" strokeWidth="2.5" strokeDasharray="5 3" fill="none" /><circle cx="10" cy="5" r="2.5" fill="#10B981" /></svg>
              Engagement contractuel lissé
            </span>
          </div>

          {}
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#FFF7ED", borderRadius: 10, border: "1px solid #FED7AA", fontSize: 11 }}>
            <span style={{ fontWeight: 600, color: "#C2410C" }}>⚠ Avril</span>
            <span style={{ color: "#92400E" }}> — Chute des assignations. À corréler avec les sorties SIRH. Engagement contractuel non ajusté.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Groupe({ filters }) {
  const allPlans = DATA.licencesByPlan;
  const [selPlans, setSelPlans] = useState(["E3"]);
  const toggle = (p) => setSelPlans(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p]);

  const entityData = DATA.groupeDataByEntity[filters.entity] || DATA.groupeDataByEntity["Toutes"];
  const plansData  = DATA.licencesByPlanByEntity[filters.entity] || DATA.licencesByPlanByEntity["Toutes"];
  const selAcquis  = selPlans.length === 0 ? plansData.reduce((s,p)=>s+p.acquises,0) : plansData.filter(p=>selPlans.includes(p.plan)).reduce((s,p)=>s+p.acquises,0);
  const totalAcq   = plansData.reduce((s,p)=>s+p.acquises,0);
  const ratio      = totalAcq > 0 ? selAcquis / totalAcq : 1;
  const ap         = (v) => Math.round(v * ratio);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Vue organisationnelle · {filters.period}</h2>
        <p style={{ color: "#64748B", fontSize: 13, margin: "4px 0 0" }}>
          {filters.entity !== "Toutes" ? `${filters.entity} · ` : ""}Répartition par région et segment métier
        </p>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, padding: "12px 20px", border: "1px solid #EEF0F6", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>Produits :</span>
        {allPlans.map(p => (
          <button key={p.plan} onClick={() => toggle(p.plan)} style={{ padding: "5px 14px", borderRadius: 20, border: `2px solid ${selPlans.includes(p.plan) ? p.couleur : "#E2E8F0"}`, background: selPlans.includes(p.plan) ? p.couleur+"18" : "#fff", color: selPlans.includes(p.plan) ? p.couleur : "#94A3B8", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
            {selPlans.includes(p.plan) ? "✓ " : ""}{p.plan}
          </button>
        ))}
        {selPlans.length === 0 && <span style={{ fontSize: 11, color: "#EF4444" }}>Sélectionnez au moins un produit</span>}
        {selPlans.length > 0 && <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 4 }}>{fmt(selAcquis)} licences · {Math.round(ratio*100)}% du périmètre {filters.entity !== "Toutes" ? filters.entity : ""}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {}
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #EEF0F6" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Vue par région</h3>
          <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 20 }}>{selPlans.length > 0 ? selPlans.join(" + ") : "—"}</p>
          {entityData.regions.map(r => {
            const licences = ap(r.l); const actifs = ap(r.a);
            const pct = licences > 0 ? Math.round(actifs/licences*100) : 0;
            const maxL = Math.max(...entityData.regions.map(x=>ap(x.l)));
            const barW = maxL > 0 ? Math.round(licences/maxL*100) : 0;
            return (
              <div key={r.r} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.r}</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#64748B" }}>{fmt(licences)} lic.</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc(pct) }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ background: "#F1F5F9", borderRadius: 6, height: 24, overflow: "hidden", position: "relative" }}>
                  <div style={{ width: `${barW}%`, background: "#4F46E5", height: "100%", transition: "width 0.4s" }} />
                  <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: barW > 25 ? "#fff" : "#334155", fontWeight: 600 }}>{fmt(actifs)} actifs</span>
                </div>
              </div>
            );
          })}
        </div>
        {}
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #EEF0F6" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Vue par segment métier</h3>
          <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 20 }}>{selPlans.length > 0 ? selPlans.join(" + ") : "—"}</p>
          {entityData.segments.map(r => {
            const licences = ap(r.l); const actifs = ap(r.a);
            const pct = licences > 0 ? Math.round(actifs/licences*100) : 0;
            const maxL = Math.max(...entityData.segments.map(x=>ap(x.l)));
            const barW = maxL > 0 ? Math.round(licences/maxL*100) : 0;
            return (
              <div key={r.s} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.s}</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#64748B" }}>{fmt(licences)} lic.</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc(pct) }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ background: "#F1F5F9", borderRadius: 6, height: 24, overflow: "hidden", position: "relative" }}>
                  <div style={{ width: `${barW}%`, background: "#7C3AED", height: "100%", transition: "width 0.4s" }} />
                  <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: barW > 25 ? "#fff" : "#334155", fontWeight: 600 }}>{fmt(actifs)} actifs</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MindMapProfils({ filters }) {
  const [expanded, setExpanded] = useState(null);
  const profiles = DATA.profiles;

  const filterMultiplier = useMemo(() => {
    if (filters.region !== "Toutes" || filters.segment !== "Tous") return 0.72;
    return 1;
  }, [filters.region, filters.segment]);

  return (
    <div style={{ background: "#16133A", borderRadius: 20, padding: 28, minHeight: 340 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#C7D2FE", marginBottom: 4 }}>Profile distribution</div>
      <div style={{ fontSize: 11, color: "#4A4870", marginBottom: 24 }}>
        Total · {fmt(Math.round(profiles.reduce((s,p)=>s+p.count,0) * filterMultiplier))} utilisateurs
        {filterMultiplier < 1 && <span style={{ color: "#7C3AED", marginLeft: 8 }}>· filtre actif</span>}
      </div>

      {}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {profiles.map(p => {
            const count = Math.round(p.count * filterMultiplier);
            const isOpen = expanded === p.nom;
            return (
              <div key={p.nom}>
                {}
                <div
                  onClick={() => setExpanded(isOpen ? null : p.nom)}
                  style={{ display: "flex", alignItems: "stretch", cursor: "pointer", userSelect: "none" }}
                >
                  {}
                  <div style={{ display: "flex", alignItems: "center", marginRight: 0 }}>
                    <div style={{ width: 24, height: 2, background: p.couleur + "60" }} />
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.couleur, flexShrink: 0 }} />
                  </div>
                  {}
                  <div style={{ background: "#1E1B4B", borderRadius: 12, borderLeft: `3px solid ${p.couleur}`, padding: "12px 16px", minWidth: 160, transition: "background 0.2s", display: "flex", gap: 14, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 10, color: p.couleur, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.nom}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "monospace", lineHeight: 1.1 }}>{fmt(count)}</div>
                      <div style={{ fontSize: 10, color: "#6D6D8F", marginTop: 2 }}>Plan : {p.plan}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ background: "#16133A", borderRadius: 4, height: 6 }}>
                        <div style={{ width: `${Math.round(count / profiles.reduce((s,x)=>s+x.count,0) * filterMultiplier * 100)}%`, background: p.couleur, height: "100%", borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 9, color: "#4A4870", marginTop: 4 }}>{Math.round(count/profiles.reduce((s,x)=>s+x.count,0)/filterMultiplier*100)}% du total</div>
                    </div>
                    <span style={{ fontSize: 12, color: p.couleur }}>{isOpen ? "▲" : "▶"}</span>
                  </div>
                </div>

                {}
                {isOpen && (
                  <div style={{ marginLeft: 32, marginTop: 8, display: "flex", gap: 24 }}>
                    {}
                    <div>
                      <div style={{ fontSize: 9, color: "#6D6D8F", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginLeft: 16 }}>Par région</div>
                      {Object.entries(p.regions).map(([reg, n]) => {
                        const fN = Math.round(n * filterMultiplier);
                        const pct = Math.round(fN / count * 100);
                        const show = filters.region === "Toutes" || filters.region === reg;
                        return (
                          <div key={reg} style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 5, opacity: show ? 1 : 0.3 }}>
                            <div style={{ width: 16, height: 2, background: p.couleur + "50" }} />
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.couleur + "90", flexShrink: 0 }} />
                            <div style={{ background: "#1A1740", borderRadius: 8, padding: "5px 10px", marginLeft: 0, display: "flex", gap: 8, alignItems: "center", minWidth: 120 }}>
                              <span style={{ fontSize: 11, color: "#A5B4FC", fontWeight: 500 }}>{reg}</span>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#fff", fontWeight: 700 }}>{fmt(fN)}</span>
                              <span style={{ fontSize: 10, color: p.couleur }}>{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {}
                    <div>
                      <div style={{ fontSize: 9, color: "#6D6D8F", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginLeft: 16 }}>Par métier</div>
                      {Object.entries(p.segments).map(([seg, n]) => {
                        const fN = Math.round(n * filterMultiplier);
                        const pct = Math.round(fN / count * 100);
                        const show = filters.segment === "Tous" || filters.segment === seg;
                        return (
                          <div key={seg} style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 5, opacity: show ? 1 : 0.3 }}>
                            <div style={{ width: 16, height: 2, background: p.couleur + "50" }} />
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.couleur + "90", flexShrink: 0 }} />
                            <div style={{ background: "#1A1740", borderRadius: 8, padding: "5px 10px", marginLeft: 0, display: "flex", gap: 8, alignItems: "center", minWidth: 130 }}>
                              <span style={{ fontSize: 11, color: "#A5B4FC", fontWeight: 500 }}>{seg}</span>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#fff", fontWeight: 700 }}>{fmt(fN)}</span>
                              <span style={{ fontSize: 10, color: p.couleur }}>{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#4A4870", marginTop: 16 }}>▶ Cliquez sur un profil pour déployer région & métier</div>
    </div>
  );
}


function Profils({ filters, liveData }) {
  const [filtre, setFiltre] = useState("Tous");
  const baseUsers = liveData?.profileUsers?.length ? liveData.profileUsers : DATA.profileUsers;

  const users = useMemo(() => {
    let u = baseUsers;
    if (filters.entity  !== "Toutes") u = u.filter(x => x.entite  === filters.entity);
    if (filters.region  !== "Toutes") u = u.filter(x => x.region  === filters.region);
    if (filters.segment !== "Tous")   u = u.filter(x => x.segment === filters.segment);
    if (filtre === "downgrade") u = u.filter(x => x.eligibleDowngrade);
    else if (filtre !== "Tous") u = u.filter(x => x.statut === filtre);
    return u;
  }, [filters, filtre]);

  const roiDowngrade = useMemo(() => {
    return users.filter(u => u.eligibleDowngrade && u.downgradeVers).reduce((s, u) => {
      const coutActuel = u.coutPlan;
      const coutCible = DATA.coutParPlan[u.downgradeVers] || 0;
      return s + (coutActuel - coutCible) * 12;
    }, 0);
  }, [users]);

  const roiInactifs = useMemo(() => {
    return users.filter(u => u.statut === "inactif").reduce((s, u) => s + u.coutPlan * 12, 0);
  }, [users]);

  const csvData = users.map(u => ({
    Prenom: u.prenom, Nom: u.nom, Email: u.email, Region: u.region,
    Entite: u.entite, Segment: u.segment, PlanTheorique: u.planTheorique,
    PlanReel: u.planReel, Statut: u.statut, EligibleDowngrade: u.eligibleDowngrade ? "Oui" : "Non",
  }));

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Profils & conformité · {filters.period}</h2>
        <p style={{ color: "#64748B", fontSize: 13, margin: "4px 0 0" }}>Distribution · Plan théorique vs réel · Éligibilité downgrade</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {}
        <MindMapProfils filters={filters} />

        {}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #EEF0F6" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>💰 ROI potentiel · périmètre filtré</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#FFFBEB", borderRadius: 12, padding: 16, borderLeft: "4px solid #F59E0B" }}>
                <div style={{ fontSize: 9, color: "#92400E", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Downgrade éligibles</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F59E0B", fontFamily: "monospace" }}>{fmtEur(roiDowngrade)}</div>
                <div style={{ fontSize: 10, color: "#92400E", marginTop: 4 }}>économie annuelle estimée<br />{users.filter(u=>u.eligibleDowngrade).length} utilisateurs concernés</div>
              </div>
              <div style={{ background: "#FFF1F2", borderRadius: 12, padding: 16, borderLeft: "4px solid #EF4444" }}>
                <div style={{ fontSize: 9, color: "#9F1239", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Comptes inactifs</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#EF4444", fontFamily: "monospace" }}>{fmtEur(roiInactifs)}</div>
                <div style={{ fontSize: 10, color: "#9F1239", marginTop: 4 }}>coût licences à libérer<br />{users.filter(u=>u.statut==="inactif").length} comptes inactifs</div>
              </div>
            </div>
            <div style={{ marginTop: 12, background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", border: "1px solid #BBF7D0" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D" }}>Total potentiel cumulé : {fmtEur(roiDowngrade + roiInactifs)} / an</div>
              <div style={{ fontSize: 10, color: "#166534", marginTop: 2 }}>Downgrade + déprov. inactifs · périmètre : {filters.region !== "Toutes" ? filters.region : "toutes régions"} · {filters.segment !== "Tous" ? filters.segment : "tous segments"}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              ["Éligibles downgrade", users.filter(u=>u.eligibleDowngrade).length, "#F59E0B"],
              ["Plan réel ≠ théorique", users.filter(u=>u.planTheorique!==u.planReel.split(" + ")[0]).length, "#7C3AED"],
              ["Inactifs", users.filter(u=>u.statut==="inactif").length, "#EF4444"],
            ].map(([l,v,c]) => (
              <div key={l} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: `1px solid ${c}30`, borderLeft: `4px solid ${c}` }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: c, fontFamily: "monospace" }}>{v}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>

          {}
          <button onClick={() => downloadCSV(csvData, `profils_${filters.period.replace(" ","_")}.csv`)} style={{ padding: "10px 20px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            ⬇ Exporter la liste utilisateurs (.csv)
          </button>
        </div>
      </div>

      {}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#64748B" }}>Afficher :</span>
        {[["Tous","Tous"],["downgrade","🔽 Éligibles downgrade"],["inactif","Inactifs"],["double","Double plan"],["bloqué","Bloqués"]].map(([val,label]) => (
          <button key={val} onClick={() => setFiltre(val)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: filtre===val?"#4F46E5":"#F1F5F9", color: filtre===val?"#fff":"#64748B" }}>{label}</button>
        ))}
        <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 8 }}>{users.length} utilisateur{users.length>1?"s":""} affichés</span>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #EEF0F6", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
              {["Utilisateur","Région","Entité","Segment","Plan théorique","Plan réel assigné","Statut","Boîte mail (Go)","Archive (Go)","OD (Go)","Teams","SP","Copilot","Downgrade","Vers","Raison"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "#94A3B8", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u,i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: u.eligibleDowngrade ? "#FFFBEB" : "#fff" }}>
                <td style={{ padding: "10px 10px", fontWeight: 600 }}>{u.prenom} {u.nom}</td>
                <td style={{ padding: "10px 10px", color: "#64748B" }}>{u.region}</td>
                <td style={{ padding: "10px 10px", color: "#64748B" }}>{u.entite}</td>
                <td style={{ padding: "10px 10px", color: "#64748B" }}>{u.segment}</td>
                <td style={{ padding: "10px 10px" }}><Tag color="#6366F1">{u.planTheorique}</Tag></td>
                <td style={{ padding: "10px 10px" }}>
                  <Tag color={u.planTheorique!==u.planReel?"#7C3AED":"#4F46E5"}>{u.planReel}</Tag>
                  {u.planTheorique!==u.planReel && <span style={{ marginLeft:4, fontSize:10, color:"#7C3AED" }}>⚠</span>}
                </td>
                <td style={{ padding: "10px 10px" }}><StatusBadge statut={u.statut} /></td>
                <td style={{ padding: "10px 10px", color: (u.mailboxSize + u.archiveSize) < 48 ? "#10B981" : "#4F46E5", fontFamily: "monospace" }}>{u.mailboxSize?.toFixed(1)}</td>
                <td style={{ padding: "10px 10px", color: u.archiveSize > 0 ? "#64748B" : "#CBD5E1", fontFamily: "monospace" }}>{u.archiveSize?.toFixed(1)}</td>
                <td style={{ padding: "10px 10px", color: u.stockageOD>10?"#4F46E5":"#64748B", fontFamily: "monospace" }}>{u.stockageOD}</td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>{u.actifTeams?"✅":"❌"}</td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>{u.actifSP?"✅":"❌"}</td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>{u.copilot?"✅":"—"}</td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>{u.eligibleDowngrade?<span style={{color:"#F59E0B",fontWeight:700}}>🔽 Oui</span>:<span style={{color:"#10B981"}}>✓</span>}</td>
                <td style={{ padding: "10px 10px" }}>{u.downgradeVers?<Tag color="#F59E0B">{u.downgradeVers}</Tag>:"—"}</td>
                <td style={{ padding: "10px 10px", color: "#64748B", fontSize: 10, maxWidth: 160 }}>{u.raisonDowngrade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Utilisateur() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("Messagerie");
  const TABS = ["Messagerie", "M365", "Adoption des outils", "Power Platform", "Copilot"];

  const results = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return DATA.allUsers.filter(u =>
      `${u.prenom} ${u.nom}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [search]);

  const u = selected;

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Vue utilisateur · M365 ID Card</h2>
        <p style={{ color: "#64748B", fontSize: 13, margin: "4px 0 0" }}>Profil complet · Licences · Adoption · Power Platform · Copilot</p>
      </div>

      {}
      <div style={{ position: "relative", marginBottom: 24, maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "8px 14px", gap: 8 }}>
          <span style={{ color: "#94A3B8", fontSize: 15 }}>🔍</span>
          <input
            value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
            placeholder="Rechercher un utilisateur (nom, email)…"
            style={{ border: "none", outline: "none", fontSize: 13, flex: 1, fontFamily: "inherit", background: "transparent", color: "#0F172A" }}
          />
          {search && <button onClick={() => { setSearch(""); setSelected(null); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8", fontSize: 14 }}>✕</button>}
        </div>
        {results.length > 0 && !selected && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, zIndex: 50, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => { setSelected(r); setSearch(`${r.prenom} ${r.nom}`); setTab("Messagerie"); }}
                style={{ padding: "10px 16px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", borderBottom: i < results.length-1 ? "1px solid #F1F5F9" : "none" }}
                onMouseEnter={e => e.currentTarget.style.background="#F8FAFC"}
                onMouseLeave={e => e.currentTarget.style.background="#fff"}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#4F46E5,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{r.prenom[0]}{r.nom[0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.prenom} {r.nom}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{r.email} · {r.fonction}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {search.length >= 2 && results.length === 0 && !selected && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, zIndex: 50, marginTop: 4, padding: "12px 16px", fontSize: 12, color: "#94A3B8" }}>Aucun utilisateur trouvé</div>
        )}
      </div>

      {!u && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Recherchez un utilisateur pour afficher son profil</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Tapez au moins 2 caractères · Essayez "Sophie" ou "Marc"</div>
        </div>
      )}

      {u && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
          {}
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #EEF0F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#4F46E5,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700 }}>{u.prenom[0]}{u.nom[0]}</div>
              <div><div style={{ fontSize: 14, fontWeight: 700 }}>{u.prenom} {u.nom}</div><div style={{ fontSize: 10, color: "#94A3B8" }}>M365 ID CARD</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
              {[["Email",u.email],["Fonction",u.fonction],["Région",u.region],["Segment",u.segment],["Entité",u.entite],["Ville",u.ville],["Pays",u.pays],["HR Class.",u.hrClass]].map(([l,v]) => (
                <div key={l} style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 7 }}>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{l}</div>
                  <div style={{ color: "#334155", fontWeight: 500, wordBreak: "break-all" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "8px 12px", background: "#EEF2FF", borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: "#6366F1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Plan assigné</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5", marginTop: 2 }}>{u.plan}</div>
            </div>
          </div>

          {}
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #EEF0F6" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Usage information</h3>
            <div style={{ display: "flex", gap: 5, marginBottom: 22, flexWrap: "wrap" }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: tab===t?"#0F172A":"#F1F5F9", color: tab===t?"#fff":"#64748B" }}>
                  {t === "Copilot" ? "✨ " : ""}{t}
                </button>
              ))}
            </div>

            {}
            {tab === "Messagerie" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[["Mails envoyés",u.adoption.mailsSent,"#4F46E5"],["Mails reçus",u.adoption.mailsRecu,"#4F46E5"],["Chat Teams",u.adoption.teamsChat,"#7C3AED"],["Réunions Teams",u.adoption.reunions,"#7C3AED"],["Taille boîte mail",u.messagerie.mailboxSize,"#10B981"],["Archive",u.messagerie.archiveSize,"#10B981"]].map(([l,v,c]) => (
                  <div key={l} style={{ padding: 16, background: "#F8FAFC", borderRadius: 10, borderTop: `3px solid ${c}` }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: "monospace" }}>{v}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{l}</div>
                  </div>
                ))}
                <div style={{ padding: 16, background: u.messagerie.litigation?"#FEF2F2":"#F8FAFC", borderRadius: 10, borderTop: `3px solid ${u.messagerie.litigation?"#EF4444":"#94A3B8"}` }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: u.messagerie.litigation?"#EF4444":"#10B981" }}>{u.messagerie.litigation?"Actif":"Inactif"}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Litigation Hold</div>
                </div>
              </div>
            )}

            {}
            {tab === "M365" && (
              <div>
                <p style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>Features incluses dans le bundle <strong>{u.plan}</strong> · État d'activation</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {Object.entries(u.licenceFeatures).map(([feature, actif]) => (
                    <div key={feature} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: actif?"#F0FDF4":"#FEF2F2", borderRadius: 8, border: `1px solid ${actif?"#BBF7D0":"#FECACA"}` }}>
                      <span style={{ fontSize: 14 }}>{actif ? "✅" : "❌"}</span>
                      <span style={{ fontSize: 11, color: actif?"#166534":"#991B1B", fontWeight: 500 }}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {}
            {tab === "Adoption des outils" && (
              <div>
                <p style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>Scores d'usage · Source : Centre d'admin Microsoft · 30 derniers jours</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {u.adoptionScores.map(s => {
                    const c = tc(s.score);
                    return (
                      <div key={s.outil} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 110, fontSize: 12, fontWeight: 500, color: "#334155", flexShrink: 0 }}>{s.outil}</div>
                        <div style={{ flex: 1, background: "#F1F5F9", borderRadius: 4, height: 10, overflow: "hidden" }}>
                          <div style={{ width: `${s.score}%`, background: c, height: "100%", borderRadius: 4 }} />
                        </div>
                        <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: c, textAlign: "right" }}>{s.score}%</div>
                        <span style={{ fontSize: 10, background: c+"18", color: c, padding: "2px 8px", borderRadius: 20, fontWeight: 600, width: 64, textAlign: "center" }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, fontSize: 11, color: "#64748B", borderLeft: "3px solid #CBD5E1" }}>
                  Source : getM365AppUserDetail · getEmailActivityUserDetail · getTeamsUserActivityUserDetail (Graph API Reports)
                </div>
              </div>
            )}

            {}
            {tab === "Power Platform" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 10, textTransform: "uppercase" }}>Environnements</h4>
                  {u.powerPlatform.envs.map((e,i) => (
                    <div key={e} style={{ padding: "10px 12px", background: i===0?"#EEF2FF":"#F8FAFC", borderRadius: 8, marginBottom: 8, fontSize: 12, fontWeight: i===0?600:400, color: i===0?"#4F46E5":"#64748B" }}>{e}</div>
                  ))}
                </div>
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 10, textTransform: "uppercase" }}>Applications</h4>
                  {u.powerPlatform.apps.map(a => (
                    <div key={a} style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: 8, marginBottom: 8, fontSize: 12, color: "#334155", borderLeft: "3px solid #4F46E5" }}>{a}</div>
                  ))}
                </div>
              </div>
            )}

            {}
            {tab === "Copilot" && (
              <div>
                {!u.copilot.actif ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#94A3B8" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Copilot M365 non actif</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Aucune interaction détectée sur cet utilisateur</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                      {[["Interactions totales",u.copilot.interactionsTotal,"#7C3AED"],["Chat Copilot",u.copilot.interactionsChat,"#4F46E5"],["Résumés générés",u.copilot.resumesGeneres,"#4F46E5"],["Emails rédigés",u.copilot.emailsRediges,"#10B981"],["Docs analysés",u.copilot.documentsAnalyses,"#10B981"],["Temps économisé",u.copilot.tempsEstimeEconomise,"#F59E0B"]].map(([l,v,c]) => (
                        <div key={l} style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, borderTop: `3px solid ${c}` }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: "monospace" }}>{v}</div>
                          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "#FAF5FF", borderRadius: 12, padding: 14, border: "1px solid #E9D5FF" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#7C3AED", marginBottom: 8 }}>✨ Agents Copilot utilisés</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {u.copilot.agentsUtilises.map(a => <Tag key={a} color="#7C3AED">{a}</Tag>)}
                      </div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>Dernière utilisation : {u.copilot.derniereUtilisation}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CONTRAT ──────────────────────────────────────────────────────────────────
function Contrat({ filters }) {
  const c = DATA.contrat;
  const totalM365 = c.plans.reduce((s,p)=>s+p.coutAnnuel,0);

  // Licences de services (noms officiels Microsoft)
  const servicesLicences = [
    { categorie: "Analytics",    nom: "Microsoft Power BI Premium Per User (PPU)",                   type: "Per user",    qte: 45,  coutUnit: 20,  coutAnnuel: 45*20*12,  engagement: "Flexible",      note: "Accès rapports Premium, paginated reports, datamarts" },
    { categorie: "Analytics",    nom: "Microsoft Fabric (capacité F4)",                              type: "Capacité",    qte: 1,   coutUnit: 4000, coutAnnuel: 4000*12,  engagement: "Flexible",      note: "SKU F4 · usage partagé Analytics / Data Engineering" },
    { categorie: "Power Platform",nom: "Power Apps Premium",                                         type: "Per user",    qte: 60,  coutUnit: 20,  coutAnnuel: 60*20*12,  engagement: "Flexible +/-10%", note: "Ex Power Apps per user plan · connecteurs Premium illimités" },
    { categorie: "Power Platform",nom: "Power Automate Premium",                                     type: "Per user",    qte: 38,  coutUnit: 15,  coutAnnuel: 38*15*12,  engagement: "Flexible",      note: "Ex per user plan with RPA · inclut attended RPA" },
    { categorie: "Copilot",       nom: "Microsoft Copilot for Microsoft 365",                        type: "Per user",    qte: 120, coutUnit: 30,  coutAnnuel: 120*30*12, engagement: "Fixe",          note: "Copilot intégré Teams, Outlook, Word, Excel, PowerPoint" },
    { categorie: "Copilot",       nom: "Microsoft Copilot Studio",                                   type: "Per tenant",  qte: 1,   coutUnit: 200, coutAnnuel: 200*12,    engagement: "Flexible",      note: "Ex Power Virtual Agents · création d'agents personnalisés" },
  ];
  const totalServices = servicesLicences.reduce((s,l)=>s+l.coutAnnuel,0);
  const totalGlobal   = totalM365 + totalServices;

  const catColors = { "Analytics": "#4F46E5", "Power Platform": "#7C3AED", "Copilot": "#10B981" };
  const [showServices, setShowServices] = useState(true);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Contrat Microsoft · {filters.period}</h2>
          <p style={{ color: "#64748B", fontSize: 13, margin: "4px 0 0" }}>Coûts unitaires · Engagement · Marges de manœuvre</p>
        </div>
        <span style={{ background: "#FEF9C3", color: "#92400E", fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: "1px solid #FDE68A" }}>🔒 Accès restreint</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiCard label="Type de contrat"     value={c.type}       color="#4F46E5" />
        <KpiCard label="Partenaire"          value={c.partenaire} color="#7C3AED" />
        <KpiCard label="Date de fin"         value={c.dateFin}    color="#F59E0B" />
        <KpiCard label="Renouvellement dans" value={`${c.renouvellementDans} mois`} sub={c.renouvellementDans<12?"⚠ Anticiper":"RAS"} color={c.renouvellementDans<12?"#EF4444":"#10B981"} alert={c.renouvellementDans<12} />
        <KpiCard label="Engagement M365"     value={fmtEur(totalM365)}     sub="Licences utilisateurs" color="#4F46E5" />
        <KpiCard label="Licences services"   value={fmtEur(totalServices)} sub="Power BI · Fabric · PP · Copilot" color="#7C3AED" />
        <KpiCard label="Total annuel"        value={fmtEur(totalGlobal)}   sub="Engagement global" color="#10B981" />
      </div>

      {/* Plans utilisateurs M365 */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #EEF0F6", marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Plans utilisateurs Microsoft 365</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
              {["Plan","Qté","Coût unit. / mois","Coût annuel","Engagement","Upgrade","Downgrade"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#94A3B8", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.plans.map((p,i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "12px 12px", fontWeight: 700, color: "#4F46E5" }}>{p.plan}</td>
                <td style={{ padding: "12px 12px", fontFamily: "monospace", fontWeight: 600 }}>{fmt(p.acquises)}</td>
                <td style={{ padding: "12px 12px", fontFamily: "monospace", color: "#10B981", fontWeight: 600 }}>{fmtEur(p.coutUnitaire)}</td>
                <td style={{ padding: "12px 12px", fontFamily: "monospace", fontWeight: 700 }}>{fmtEur(p.coutAnnuel)}</td>
                <td style={{ padding: "12px 12px" }}><span style={{ background: p.engagement.includes("Flexible")?"#DCFCE7":"#FEE2E2", color: p.engagement.includes("Flexible")?"#16A34A":"#DC2626", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{p.engagement}</span></td>
                <td style={{ padding: "12px 12px", textAlign: "center" }}>{p.upgrade?"✅":"❌"}</td>
                <td style={{ padding: "12px 12px", textAlign: "center" }}>{p.downgrade?"✅":"❌"}</td>
              </tr>
            ))}
            <tr style={{ background: "#F0F4FF", fontWeight: 700 }}>
              <td colSpan={3} style={{ padding: "10px 12px", fontSize: 12 }}>Sous-total M365 utilisateurs</td>
              <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#4F46E5", fontWeight: 800 }}>{fmtEur(totalM365)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Licences de services */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #EEF0F6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Licences de services · Analytics · Power Platform · Copilot</h3>
          <button onClick={() => setShowServices(s=>!s)} style={{ fontSize: 11, color: "#64748B", background: "#F1F5F9", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>{showServices ? "Réduire ▲" : "Afficher ▼"}</button>
        </div>
        {showServices && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                {["Catégorie","Licence (nom officiel Microsoft)","Type","Qté","Coût unit. / mois","Coût annuel","Engagement","Note"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#94A3B8", fontWeight: 600, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servicesLicences.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: catColors[l.categorie]+"18", color: catColors[l.categorie], padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{l.categorie}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0F172A", fontSize: 11 }}>{l.nom}</td>
                  <td style={{ padding: "10px 12px", color: "#64748B", fontSize: 11 }}>{l.type}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 600 }}>{fmt(l.qte)}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#10B981", fontWeight: 600 }}>{fmtEur(l.coutUnit)}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700 }}>{fmtEur(l.coutAnnuel)}</td>
                  <td style={{ padding: "10px 12px" }}><span style={{ background: l.engagement.includes("Flexible")?"#DCFCE7":"#FEE2E2", color: l.engagement.includes("Flexible")?"#16A34A":"#DC2626", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{l.engagement}</span></td>
                  <td style={{ padding: "10px 12px", color: "#94A3B8", fontSize: 10, maxWidth: 200 }}>{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "2px solid #E2E8F0" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Total global engagement annuel</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#4F46E5", fontFamily: "monospace" }}>{fmtEur(totalGlobal)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── GLOSSAIRE ────────────────────────────────────────────────────────────────
function Glossaire({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 36, maxWidth: 680, width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📖 Critères d'adoption par workload</h2>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#64748B" }}>Fermer</button>
        </div>
        {Object.entries(DATA.adoptionCriteres).map(([w, d]) => (
          <div key={w} style={{ marginBottom: 14, padding: 14, background: d.modifie?"#FFFBEB":"#F8FAFC", borderRadius: 10, border: `1px solid ${d.modifie?"#FDE68A":"#E2E8F0"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{w}</span>
              {d.modifie && <span style={{ fontSize: 10, background: "#FEF9C3", color: "#92400E", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>critère modifié</span>}
            </div>
            <p style={{ fontSize: 12, color: "#334155", margin: 0 }}><strong>Base MS :</strong> {d.base}</p>
            {d.modifie && <p style={{ fontSize: 12, color: "#92400E", margin: "6px 0 0" }}>⚙ <strong>Modif. :</strong> {d.modifieNote}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const BASE_NAV = ["Scorecard", "Licences", "Groupe", "Profils", "Utilisateur"];
const NAV_ITEMS = USER_ROLE === "admin" ? [...BASE_NAV, "Contrat"] : BASE_NAV;

// Bannière de statut API (chargement / erreur / source des données)
function ApiBanner({ loading, hasErrors, errors }) {
  if (loading) return (
    <div style={{ background: "#EFF6FF", borderBottom: "1px solid #BFDBFE", padding: "6px 28px", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#1D4ED8" }}>
      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
      Chargement des données Graph API en cours…
    </div>
  );
  if (hasErrors) return (
    <div style={{ background: "#FFFBEB", borderBottom: "1px solid #FDE68A", padding: "6px 28px", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#92400E" }}>
      ⚠ Certaines données sont fictives — erreur API :
      {Object.entries(errors).filter(([,v])=>v).map(([k,v]) => (
        <span key={k} style={{ background: "#FEF3C7", padding: "1px 8px", borderRadius: 4, fontFamily: "monospace", marginLeft: 4 }}>{k}: {v.includes("403") ? "403 Forbidden — vérifier le consentement admin Azure AD" : v.slice(0, 60)}</span>
      ))}
    </div>
  );
  return (
    <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "6px 28px", fontSize: 11, color: "#15803D" }}>
      ✓ Données Graph API chargées — tenant réel
    </div>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState("Scorecard");
  const [filters, setFilters] = useState({ period: "Mai 2025", region: "Toutes", entity: "Toutes", segment: "Tous" });
  const [glossaire, setGlossaire] = useState(false);
  const setFilter = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }));
  const sel = { padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, color: "#334155", background: "#F8FAFC", cursor: "pointer", fontFamily: "inherit" };

  // ── Données Graph API réelles (avec fallback sur DATA fictives) ──
  const graphData = useDashboardData();

  // Fusionner : données réelles prioritaires, fictives en fallback
  const liveData = {
    licencesByPlan:    graphData.licencesByPlan    || DATA.licencesByPlan,
    scorecard:         graphData.scorecard         || DATA.scorecard,
    adoptionByWorkload:graphData.adoptionByWorkload?.length
                         ? graphData.adoptionByWorkload
                         : DATA.adoptionByWorkload,
    profileUsers:      graphData.profileUsers      || DATA.profileUsers,
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#F8FAFC", minHeight: "100vh", color: "#0F172A" }}>
      {glossaire && <Glossaire onClose={() => setGlossaire(false)} />}

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#4F46E5,#7C3AED)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>M</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>M365 Dashboard</div>
            <div style={{ fontSize: 10, color: graphData.hasErrors ? "#F59E0B" : graphData.loading ? "#94A3B8" : "#10B981" }}>
              {graphData.loading ? "Chargement…" : graphData.hasErrors ? "Données partielles" : "Données Graph API réelles"}
            </div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <button key={item} onClick={() => setActiveNav(item)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: activeNav===item?"#4F46E5":"transparent", color: activeNav===item?"#fff":item==="Contrat"?"#F59E0B":"#64748B" }}>
              {item === "Contrat" ? "🔒 " : ""}{item}
            </button>
          ))}
        </nav>
        <div style={{ fontSize: 10, color: "#94A3B8" }}>Tenant · EU</div>
      </div>

      {/* Bannière statut API */}
      <ApiBanner loading={graphData.loading} hasErrors={graphData.hasErrors} errors={graphData.errors} />

      {/* Filtres : Période · Région · Entité · Segment */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "9px 28px", display: "flex", gap: 10, alignItems: "center" }}>
        <select value={filters.period}  onChange={setFilter("period")}  style={sel}>{DATA.periods.map(o=><option key={o}>{o}</option>)}</select>
        <select value={filters.region}  onChange={setFilter("region")}  style={sel}>{DATA.regions.map(o=><option key={o}>{o}</option>)}</select>
        <select value={filters.entity}  onChange={setFilter("entity")}  style={sel}>{DATA.entities.map(o=><option key={o}>{o}</option>)}</select>
        <select value={filters.segment} onChange={setFilter("segment")} style={sel}>{DATA.segments.map(o=><option key={o}>{o}</option>)}</select>
        <span style={{ fontSize: 10, color: "#CBD5E1", marginLeft: 4 }}>Période · Région · Entité · Segment</span>
      </div>

      <div style={{ padding: "26px 28px", maxWidth: 1400, margin: "0 auto" }}>
        {activeNav === "Scorecard"   && <Scorecard   filters={filters} setGlossaire={setGlossaire} liveData={liveData} />}
        {activeNav === "Licences"    && <Licences    filters={filters} liveData={liveData} />}
        {activeNav === "Groupe"      && <Groupe      filters={filters} />}
        {activeNav === "Profils"     && <Profils     filters={filters} liveData={liveData} />}
        {activeNav === "Utilisateur" && <Utilisateur />}
        {activeNav === "Contrat" && USER_ROLE === "admin" && <Contrat filters={filters} />}
      </div>

      <div style={{ borderTop: "1px solid #E2E8F0", padding: "10px 28px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>M365 Dashboard · {graphData.hasErrors ? "Données partiellement fictives" : "Données Graph API réelles"}</span>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>Source : Microsoft Graph API · SIRH croisé · {filters.period}</span>
      </div>
    </div>
  );
}
