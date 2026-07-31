import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDirectory = path.join(root, "data", "users");
const outputDirectory = path.join(root, "dashboard", "public", "data", "users");

function isUserData(value) {
  if (!value || typeof value !== "object") return false;
  return (
    typeof value.githubId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.profileImageUrl === "string" &&
    typeof value.joinedAt === "string" &&
    Boolean(value.days && typeof value.days === "object")
  );
}

await mkdir(sourceDirectory, { recursive: true });
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
const filenames = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".json")).sort();
const users = [];

for (const filename of filenames) {
  const contents = await readFile(path.join(sourceDirectory, filename), "utf8");
  const parsed = JSON.parse(contents);
  if (!isUserData(parsed)) throw new Error(`${filename}의 사용자 데이터 형식이 올바르지 않습니다.`);
  if (filename !== `${parsed.githubId}.json`) {
    throw new Error(`${filename}의 파일명과 githubId(${parsed.githubId})가 일치하지 않습니다.`);
  }
  users.push(parsed);
  await writeFile(path.join(outputDirectory, filename), `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

await writeFile(path.join(outputDirectory, "index.json"), `${JSON.stringify(users, null, 2)}\n`, "utf8");
console.log(`Generated dashboard data for ${users.length} user(s).`);
