export type Coordinate = [longitude: number, latitude: number];

export interface Route {
  id: "suez" | "cape";
  name: string;
  shortName: string;
  description: string;
  coordinates: Coordinate[];
}

export const routes: Route[] = [
  {
    id: "suez",
    name: "Jebel Ali → Rotterdam via Suez",
    shortName: "Via Suez",
    description: "Arabian Sea · Red Sea · Mediterranean",
    coordinates: [
      [55.06, 25.01],
      [56.3, 24.3],
      [58.5, 22.4],
      [59.7, 18.8],
      [55.5, 14.4],
      [49.5, 12.5],
      [45.0, 12.2],
      [43.3, 12.7],
      [42.5, 15.5],
      [39.7, 19.3],
      [37.2, 23.0],
      [34.6, 27.7],
      [32.55, 29.95],
      [32.3, 31.25],
      [29.2, 32.8],
      [23.4, 34.5],
      [16.0, 37.1],
      [10.0, 37.8],
      [4.0, 37.0],
      [-1.5, 36.1],
      [-5.6, 35.9],
      [-9.4, 36.8],
      [-10.2, 43.0],
      [-8.5, 48.8],
      [-4.6, 50.2],
      [1.4, 51.2],
      [3.95, 51.98],
    ],
  },
  {
    id: "cape",
    name: "Jebel Ali → Rotterdam via Cape of Good Hope",
    shortName: "Via the Cape",
    description: "Indian Ocean · Cape of Good Hope · Atlantic",
    coordinates: [
      [55.06, 25.01],
      [57.0, 22.5],
      [58.8, 18.0],
      [57.0, 12.0],
      [54.0, 5.0],
      [50.0, -4.0],
      [45.0, -13.0],
      [39.0, -22.0],
      [33.0, -30.0],
      [25.5, -35.2],
      [18.0, -35.0],
      [12.0, -31.0],
      [7.0, -23.0],
      [3.0, -13.0],
      [-1.0, -2.0],
      [-6.0, 10.0],
      [-11.0, 22.0],
      [-14.0, 34.0],
      [-14.0, 43.0],
      [-10.2, 48.0],
      [-4.6, 50.2],
      [1.4, 51.2],
      [3.95, 51.98],
    ],
  },
];
