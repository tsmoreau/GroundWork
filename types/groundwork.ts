export interface ISnapshot {
  center: { lat: number; lng: number };
  zoom: number;
  heading: number;
}

export interface ILayer {
  id: string;
  name: string;
  visible: boolean;
  order: number;
}

export interface IProject {
  _id: string;
  name: string;
  snapshot: ISnapshot | null;
  layers: ILayer[];
  visibility: "private" | "public";
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectMember {
  _id: string;
  projectId: string;
  userId: string | null;
  email: string;
  role: "owner" | "editor" | "viewer";
  invitedAt: Date;
}

export interface IFeatureProperties {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  arrowStart: boolean;
  arrowEnd: boolean;
  label: string;
  text: string;
  fontSize: number;
}

export interface IFeature {
  _id: string;
  projectId: string;
  layerId: string;
  groupId: string | null;
  type: "polygon" | "rectangle" | "circle" | "polyline" | "line" | "text";
  geometry: GeoJSON.Geometry;
  properties: Partial<IFeatureProperties>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroup {
  _id: string;
  projectId: string;
  groupId: string;
  sharedProperties: {
    fillColor: string | null;
    strokeColor: string | null;
  };
}

export type ProjectRole = "owner" | "editor" | "viewer";
