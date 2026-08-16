/* ==========================================================================
   ASTRIX PARADOX - GUARDIAN WORKSPACE ROOT COORDINATOR
   Coordinates live Bungie OAuth profile ingestion, character/fixture switching,
   loadout state synchronization, and dispatch to workspace components.
   ========================================================================== */

const STORAGE_KEYS = {
  bungieAuth: "astrix_bungie_auth_token",
  membershipId: "astrix_bungie_membership_id",
  membershipType: "astrix_bungie_membership_type",
  activeCharacter: "astrix_active_character_id"
};

const BUNGIE_COMPONENTS = [
  100, // Profiles
  200, // Characters
  205, // CharacterEquipment
  300, // ItemInstances
  302, // ItemPerks
  304, // ItemRenderData
  305, // ItemSockets
  307  // ItemPlugObjectives
];

class GuardianWorkspaceCoordinator {
  constructor() {
    this.isAuthenticated = false;
    this.activeMembershipId = null;
    this.activeMembershipType = null;
    this.activeCharacterId = null;
    this.profileData = null;

    this.init();
  }

  init() {
    this.checkSession();
    this.bindGlobalEvents();
    this.registerActionbarTriggers();
  }

  checkSession() {
    const token = sessionStorage.getItem(STORAGE_KEYS.bungieAuth) || localStorage.getItem(STORAGE_KEYS.bungieAuth);
    const membershipId = sessionStorage.getItem(STORAGE_KEYS.membershipId) || localStorage.getItem(STORAGE_KEYS.membershipId);
    const membershipType = sessionStorage.getItem(STORAGE_KEYS.membershipType) || localStorage.getItem(STORAGE_KEYS.membershipType);

    if (token && membershipId && membershipType) {
      this.isAuthenticated = true;
      this.activeMembershipId = membershipId;
      this.activeMembershipType = membershipType;
      this.activeCharacterId = sessionStorage.getItem(STORAGE_KEYS.activeCharacter);
    }
  }

  bindGlobalEvents() {
    // Listen for live Bungie profile updates dispatched from worker/services
    document.addEventListener("astrix:bungie-profile-received", (event) => {
      this.handleLiveProfile(event.detail);
    });

    // Listen for character switches
    document.addEventListener("astrix:character-selected", (event) => {
      if (event.detail?.characterId) {
        this.setActiveCharacter(event.detail.characterId);
      }
    });

    // Listen for loadout selections (1-20)
    document.addEventListener("astrix:loadout-selected", (event) => {
      this.applySavedLoadout(event.detail);
    });
  }

  registerActionbarTriggers() {
    const improveCta = document.querySelector(".improve-cta");
    if (improveCta) {
      improveCta.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("astrix:request-build-optimization", {
          detail: { source: "workspace-actionbar" }
        }));
      });
    }
  }

  handleLiveProfile(profilePayload) {
    if (!profilePayload) return;
    this.profileData = profilePayload;

    const characters = profilePayload.characters?.data || {};
    const characterList = Object.values(characters);

    if (!characterList.length) {
      console.warn("[Workspace Coordinator] No character data in Bungie profile payload.");
      return;
    }

    // Default to stored active character or first available
    if (!this.activeCharacterId || !characters[this.activeCharacterId]) {
      this.activeCharacterId = characterList[0].characterId;
      sessionStorage.setItem(STORAGE_KEYS.activeCharacter, this.activeCharacterId);
    }

    this.syncActiveCharacterToWorkspace(this.activeCharacterId);
  }

  setActiveCharacter(characterId) {
    if (!characterId) return;
    this.activeCharacterId = characterId;
    sessionStorage.setItem(STORAGE_KEYS.activeCharacter, characterId);

    if (this.profileData) {
      this.syncActiveCharacterToWorkspace(characterId);
    }
  }

  syncActiveCharacterToWorkspace(characterId) {
    const character = this.profileData?.characters?.data?.[characterId];
    if (!character) return;

    // Dispatch normalized live data packet to runtime authority
    document.dispatchEvent(new CustomEvent("astrix:guardian-selection-changed", {
      detail: {
        characterId,
        source: "bungie-live-profile",
        characterClass: this.resolveClassType(character.classType),
        power: character.light || 0,
        emblem: {
          background: character.emblemBackgroundPath,
          icon: character.emblemPath
        },
        stats: character.stats ? Object.entries(character.stats) : null
      }
    }));
  }

  applySavedLoadout(loadoutDetail) {
    document.dispatchEvent(new CustomEvent("astrix:guardian-selection-changed", {
      detail: {
        ...loadoutDetail,
        source: "bungie-saved-loadout"
      }
    }));
  }

  resolveClassType(classType) {
    switch (Number(classType)) {
      case 0: return "titan";
      case 1: return "hunter";
      case 2: return "warlock";
      default: return "hunter";
    }
  }
}

// Instantiate root coordinator
globalThis.ASTRIXWorkspace = new GuardianWorkspaceCoordinator();