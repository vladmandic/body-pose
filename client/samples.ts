const localUrl = '';
const localFolderNames = ['media/samples', 'media/local'];
const repositoryUrl = 'https://api.github.com/repos/motioniq-ai/media/git/trees/main';
const repositoryPrefix = 'https://motioniq-ai.github.io/media';
const repositoryFolderNames = ['samples'];

async function listGitFiles(subDir: string): Promise<string[]> {
  const files: string[] = [];
  let res = await fetch(repositoryUrl);
  if (res && res.ok) {
    let json = await res.json();
    console.log({ json });
    if (json.tree && json.tree.length > 0) {
      const dirUrl = json.tree.find((entry: { path: string; }) => entry.path === subDir);
      if (dirUrl && dirUrl.url) {
        res = await fetch(dirUrl.url);
        if (res && res.ok) {
          json = await res.json();
          if (json && json.tree && json.tree.length > 0) {
            for (const f of json.tree) {
              if ((f.path as string).endsWith('.jpg') || (f.path as string).endsWith('.webm')) files.push(f.path);
            }
          }
        }
      }
    }
  }
  console.log({ files });
  return files;
}

async function listLocalFiles(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (res && res.ok) {
    const json = await res.json();
    if (json && Array.isArray(json)) {
      const filtered = json.filter((f) => (f.endsWith('.jpg') || f.endsWith('.webm')));
      return filtered;
    }
  }
  return [];
}

export async function getSamples() {
  const files: string[] = [];
  for (const folderName of localFolderNames) {
    const localFiles = await listLocalFiles(localUrl + folderName);
    if (localFiles.length > 0) files.push(...localFiles.map((f) => `..${f}`));
  }
  if (files.length > 0) return files;
  for (const folderName of repositoryFolderNames) {
    const gitFiles = await listGitFiles(folderName);
    files.push(...gitFiles.map((f) => `${repositoryPrefix}/${folderName}/${f}`));
  }
  console.log({ files });
  return files;
}
