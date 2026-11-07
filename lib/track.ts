export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl?: string | null;
  albumTitle?: string | null;
  albumId?: string | null;
};

export function streamUrlFor(id: string): string {
  return `/api/v1/songs/${id}/stream`;
}
