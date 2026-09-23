import {
  LIFECYCLE_STATUSES,
  type LifecycleStatus,
} from "@/lib/domain/status";

export const STRUCTURE_TYPES = [
  "hoarding",
  "unipole",
  "gantry",
  "bridge_panel",
  "pole_kiosk",
  "led_screen",
  "other",
] as const;

export const ILLUMINATION_OPTIONS = [
  "frontlit",
  "backlit",
  "nonlit",
  "led",
] as const;

export const OWNERSHIP_TYPES = [
  "owned",
  "leased_in",
  "managed_for_third_party",
] as const;

export const PHOTO_KINDS = ["day", "night", "approach", "other"] as const;

export type StructureType = (typeof STRUCTURE_TYPES)[number];
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export type BoardFaceInput = {
  face_label: string;
  width_ft: string;
  height_ft: string;
  illumination: string;
  card_rate_rupees: string;
  floor_rate_rupees: string;
  printing_charge_rupees: string;
  mounting_charge_rupees: string;
  facing_direction: string;
};

export type BoardFormValues = {
  board_code: string;
  name: string;
  structure_type: string;
  ownership_type: OwnershipType | string;
  installed_on: string;
  ward_zone: string;
  street_view_url: string;
  meter_no: string;
  lifecycle_status: LifecycleStatus;
  address_line: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  pin_code: string;
  road_name: string;
  lat: string;
  lng: string;
  how_to_reach: string;
  faces: BoardFaceInput[];
};

export function emptyFace(label = "A"): BoardFaceInput {
  return {
    face_label: label,
    width_ft: "40",
    height_ft: "20",
    illumination: "frontlit",
    card_rate_rupees: "60000",
    floor_rate_rupees: "",
    printing_charge_rupees: "",
    mounting_charge_rupees: "",
    facing_direction: "",
  };
}

export function defaultBoardForm(): BoardFormValues {
  return {
    board_code: "",
    name: "",
    structure_type: "hoarding",
    ownership_type: "owned",
    installed_on: "",
    ward_zone: "",
    street_view_url: "",
    meter_no: "",
    lifecycle_status: "draft",
    address_line: "",
    landmark: "",
    city: "",
    district: "",
    state: "",
    pin_code: "",
    road_name: "",
    lat: "",
    lng: "",
    how_to_reach: "",
    faces: [emptyFace("A")],
  };
}

/** Parse "12.97, 77.59" or a Google Maps URL with @lat,lng */
export function parseLatLngInput(raw: string): { lat: string; lng: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const atMatch = trimmed.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: atMatch[1], lng: atMatch[2] };
  }

  const qMatch = trimmed.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (qMatch) {
    return { lat: qMatch[1], lng: qMatch[2] };
  }

  const pair = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (pair) {
    return { lat: pair[1], lng: pair[2] };
  }

  return null;
}

export function toBoardPayload(organizationId: string, values: BoardFormValues) {
  const lat = values.lat.trim() ? Number(values.lat) : null;
  const lng = values.lng.trim() ? Number(values.lng) : null;

  return {
    organization_id: organizationId,
    board_code: values.board_code.trim().toUpperCase(),
    name: values.name.trim(),
    structure_type: values.structure_type,
    ownership_type: values.ownership_type || "owned",
    installed_on: values.installed_on.trim() || null,
    ward_zone: values.ward_zone.trim() || null,
    street_view_url: values.street_view_url.trim() || null,
    meter_no: values.meter_no.trim() || null,
    lifecycle_status: values.lifecycle_status,
    address_line: values.address_line.trim() || null,
    landmark: values.landmark.trim() || null,
    city: values.city.trim() || null,
    district: values.district.trim() || null,
    state: values.state.trim() || null,
    pin_code: values.pin_code.trim() || null,
    road_name: values.road_name.trim() || null,
    how_to_reach: values.how_to_reach.trim() || null,
    lat: lat != null && !Number.isNaN(lat) ? lat : null,
    lng: lng != null && !Number.isNaN(lng) ? lng : null,
  };
}

export function toFacePayloads(
  organizationId: string,
  boardId: string,
  faces: BoardFaceInput[],
) {
  const rupeesToPaise = (raw: string) =>
    raw.trim() ? Math.round(Number(raw) * 100) : null;

  return faces
    .filter((f) => f.face_label.trim())
    .map((f) => ({
      organization_id: organizationId,
      board_id: boardId,
      face_label: f.face_label.trim(),
      width_ft: f.width_ft ? Number(f.width_ft) : null,
      height_ft: f.height_ft ? Number(f.height_ft) : null,
      illumination: f.illumination || "nonlit",
      facing_direction: f.facing_direction.trim() || null,
      card_rate_paise: rupeesToPaise(f.card_rate_rupees),
      floor_rate_paise: rupeesToPaise(f.floor_rate_rupees),
      printing_charge_paise: rupeesToPaise(f.printing_charge_rupees),
      mounting_charge_paise: rupeesToPaise(f.mounting_charge_rupees),
    }));
}

export { LIFECYCLE_STATUSES };
