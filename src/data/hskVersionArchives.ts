import archiveV2 from "./hskVersions/pdf-e80a3cbaabc5-audio-1d13ab13-choice-v2.json";
import archiveV3 from "./hskVersions/pdf-e80a3cbaabc5-audio-1d13ab13-sequential-v3.json";
import archiveV4 from "./hskVersions/pdf-e80a3cbaabc5-audio-1d13ab13-screening15-v4.json";

const archives = [archiveV2, archiveV3, archiveV4];

export function readHskVersionArchive(examVersion: string) {
  return archives.find(archive => archive.examVersion === examVersion);
}
