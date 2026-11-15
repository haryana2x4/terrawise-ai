using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

[assembly: AssemblyTitle("Kshetra Precision Smart Farming Desktop")]
[assembly: AssemblyProduct("Kshetra Desktop")]
[assembly: AssemblyVersion("2.4.1.0")]
[assembly: AssemblyFileVersion("2.4.1.0")]

namespace KshetraDesktop
{
    internal static class Program
    {
        private static readonly string[] LocalCandidateUrls = new[]
        {
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5000",
            "http://localhost:5173",
            "http://localhost:5000",
        };

        private static string AppStateDir
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Kshetra"
                );
            }
        }

        private static string SavedUrlPath
        {
            get { return Path.Combine(AppStateDir, "saved-url.txt"); }
        }

        private static string SavedRepoPath
        {
            get { return Path.Combine(AppStateDir, "saved-repo.txt"); }
        }

        [STAThread]
        private static void Main(string[] args)
        {
            if (args != null && args.Length > 0 && args[0] == "--self-check")
            {
                string embedded = ReadEmbeddedUrlFromExe() ?? "";
                string repo = FindRepoRoot(AppDomain.CurrentDomain.BaseDirectory) ?? "";
                Console.WriteLine("EMBEDDED_URL=" + embedded);
                Console.WriteLine("REPO_ROOT=" + repo);
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool createdNew;
            using (Mutex singleInstance = new Mutex(true, "Local\\KshetraDesktopLauncherMutex", out createdNew))
            {
                if (!createdNew)
                {
                    // Another instance is already resolving/connecting; probe fast without spawning duplicate dialogs.
                    string quick = ProbeCandidateUrls(LocalCandidateUrls);
                    if (!string.IsNullOrEmpty(quick))
                    {
                        LaunchAppWindow(quick);
                    }
                    return;
                }

                RunLauncher(args);
            }
        }

        private static void RunLauncher(string[] args)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;

            // 1. CLI argument or adjacent kshetra-url.txt override
            string explicitUrl = ResolveExplicitUrl(args, baseDir);
            if (!string.IsNullOrEmpty(explicitUrl) && IsReachable(explicitUrl))
            {
                OpenAndExit(explicitUrl);
                return;
            }

            // 2. Fast check for an already-running local Kshetra server
            string localUrl = ProbeCandidateUrls(LocalCandidateUrls);
            if (!string.IsNullOrEmpty(localUrl))
            {
                OpenAndExit(localUrl);
                return;
            }

            // 3. Embedded server URL written into PE overlay by /api/v1/meta/download/windows-exe?target=...
            string embeddedUrl = ReadEmbeddedUrlFromExe();
            if (!string.IsNullOrEmpty(embeddedUrl) && IsReachable(embeddedUrl))
            {
                OpenAndExit(embeddedUrl);
                return;
            }

            // 4. Saved user URL in %LOCALAPPDATA%\Kshetra\saved-url.txt
            string savedUrl = ReadFirstValidLine(SavedUrlPath);
            if (!string.IsNullOrEmpty(savedUrl) && IsReachable(savedUrl))
            {
                OpenAndExit(savedUrl);
                return;
            }

            // 5. Auto-discover local Kshetra repository folder (including Downloads, Desktop, Documents, scratch)
            string discoveredRepo = FindRepoRoot(baseDir);
            if (!string.IsNullOrEmpty(discoveredRepo))
            {
                string bootedUrl = StartRepoWithSplash(discoveredRepo);
                if (!string.IsNullOrEmpty(bootedUrl))
                {
                    OpenAndExit(bootedUrl);
                    return;
                }
            }

            // 6. Interactive Kshetra Connect / Setup window (no dead-end popup)
            ShowConnectDialog(explicitUrl ?? embeddedUrl ?? savedUrl, discoveredRepo);
        }

        private static void OpenAndExit(string url)
        {
            if (!LaunchAppWindow(url))
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
        }

        private static string ResolveExplicitUrl(string[] args, string baseDir)
        {
            if (args != null && args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]))
            {
                string candidate = args[0].Trim();
                if (IsHttpUrl(candidate))
                {
                    return candidate;
                }
            }
            return ReadFirstValidLine(Path.Combine(baseDir, "kshetra-url.txt"));
        }

        private static string ReadFirstValidLine(string filePath)
        {
            try
            {
                if (!File.Exists(filePath)) return null;
                foreach (string raw in File.ReadAllLines(filePath))
                {
                    string line = raw.Trim();
                    if (!string.IsNullOrEmpty(line) && !line.StartsWith("#") && IsHttpUrl(line))
                    {
                        return line;
                    }
                }
            }
            catch
            {
                // Ignore IO access errors cleanly
            }
            return null;
        }

        private static string ReadEmbeddedUrlFromExe()
        {
            try
            {
                string exePath = Application.ExecutablePath;
                if (!File.Exists(exePath)) return null;
                using (FileStream fs = new FileStream(exePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    int tailLen = (int)Math.Min(4096, fs.Length);
                    fs.Seek(-tailLen, SeekOrigin.End);
                    byte[] buf = new byte[tailLen];
                    int read = fs.Read(buf, 0, tailLen);
                    string tail = Encoding.UTF8.GetString(buf, 0, read);
                    const string marker = "__KSHETRA_CFG__=";
                    int idx = tail.LastIndexOf(marker, StringComparison.Ordinal);
                    if (idx < 0) return null;
                    string payload = tail.Substring(idx + marker.Length).Trim();
                    Match m = Regex.Match(payload, "\"url\"\\s*:\\s*\"(https?://[^\"]+)\"");
                    if (m.Success)
                    {
                        return m.Groups[1].Value.Trim();
                    }
                }
            }
            catch
            {
                // Ignore malformed tail cleanly
            }
            return null;
        }

        private static bool IsHttpUrl(string value)
        {
            return value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                   value.StartsWith("https://", StringComparison.OrdinalIgnoreCase);
        }

        private static string ProbeCandidateUrls(string[] candidates)
        {
            foreach (string url in candidates)
            {
                if (IsReachable(url))
                {
                    return url;
                }
            }
            return null;
        }

        private static bool IsReachable(string url)
        {
            return ProbeHttp(url.TrimEnd('/') + "/healthz") || ProbeHttp(url);
        }

        private static bool ProbeHttp(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "GET";
                req.Timeout = 1200;
                req.AllowAutoRedirect = true;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    int code = (int)resp.StatusCode;
                    return code >= 200 && code < 500;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool IsKshetraRepoDir(string path)
        {
            try
            {
                return !string.IsNullOrEmpty(path) &&
                       Directory.Exists(path) &&
                       File.Exists(Path.Combine(path, "start.py")) &&
                       File.Exists(Path.Combine(path, "backend", "wsgi.py"));
            }
            catch
            {
                return false;
            }
        }

        private static string FindRepoRoot(string baseDir)
        {
            // 1. Saved repo path or adjacent kshetra-repo.txt
            foreach (string pathFile in new[] { Path.Combine(baseDir, "kshetra-repo.txt"), SavedRepoPath })
            {
                try
                {
                    if (File.Exists(pathFile))
                    {
                        string saved = File.ReadAllText(pathFile).Trim();
                        if (IsKshetraRepoDir(saved)) return saved;
                    }
                }
                catch { }
            }

            // 2. Walk up ancestors from the .exe location
            DirectoryInfo dir = new DirectoryInfo(baseDir);
            for (int depth = 0; depth < 6 && dir != null; depth++)
            {
                if (IsKshetraRepoDir(dir.FullName)) return dir.FullName;
                dir = dir.Parent;
            }

            // 3. Scan common workspace / Downloads / Desktop / Documents / Scratch folders up to depth 2
            string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            List<string> roots = new List<string>
            {
                baseDir,
                Path.Combine(profile, ".gemini", "antigravity", "scratch"),
                Path.Combine(profile, "Downloads"),
                Path.Combine(profile, "Desktop"),
                Path.Combine(profile, "Documents"),
                Path.Combine(profile, "Projects"),
                Path.Combine(profile, "source", "repos"),
            };

            foreach (string root in roots)
            {
                string found = SearchSubdirsForRepo(root, 2);
                if (!string.IsNullOrEmpty(found)) return found;
            }
            return null;
        }

        private static string SearchSubdirsForRepo(string dirPath, int remainingDepth)
        {
            try
            {
                if (!Directory.Exists(dirPath)) return null;
                if (IsKshetraRepoDir(dirPath)) return dirPath;
                if (remainingDepth <= 0) return null;

                foreach (string sub in Directory.GetDirectories(dirPath))
                {
                    string name = Path.GetFileName(sub);
                    if (name.StartsWith(".") || name == "node_modules" || name == ".venv" || name == "__pycache__")
                    {
                        continue;
                    }
                    string found = SearchSubdirsForRepo(sub, remainingDepth - 1);
                    if (!string.IsNullOrEmpty(found)) return found;
                }
            }
            catch
            {
                // Ignore permission-restricted directories
            }
            return null;
        }

        private static string FindPythonExecutable(string repoRoot)
        {
            List<string> candidates = new List<string>();
            if (!string.IsNullOrEmpty(repoRoot))
            {
                candidates.Add(Path.Combine(repoRoot, ".venv", "Scripts", "pythonw.exe"));
                candidates.Add(Path.Combine(repoRoot, ".venv", "Scripts", "python.exe"));
                candidates.Add(Path.Combine(repoRoot, "venv", "Scripts", "python.exe"));
            }

            string localPrograms = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                "Python"
            );
            if (Directory.Exists(localPrograms))
            {
                try
                {
                    foreach (string pyDir in Directory.GetDirectories(localPrograms, "Python3*"))
                    {
                        candidates.Add(Path.Combine(pyDir, "pythonw.exe"));
                        candidates.Add(Path.Combine(pyDir, "python.exe"));
                    }
                }
                catch { }
            }

            foreach (string c in candidates)
            {
                if (File.Exists(c)) return c;
            }

            return "python";
        }

        private static bool StartLocalBackend(string repoRoot)
        {
            try
            {
                string pythonExe = FindPythonExecutable(repoRoot);
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = pythonExe,
                    Arguments = "start.py --no-browser --share --prod",
                    WorkingDirectory = repoRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                Process.Start(psi);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static string StartRepoWithSplash(string repoRoot)
        {
            if (!StartLocalBackend(repoRoot))
            {
                return null;
            }

            string resultUrl = null;
            Form splash = new Form
            {
                Text = "Kshetra Desktop",
                Width = 420,
                Height = 165,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                StartPosition = FormStartPosition.CenterScreen,
                BackColor = Color.FromArgb(12, 20, 17),
                ForeColor = Color.White,
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath),
            };

            Label title = new Label
            {
                Text = "Kshetra — Precision Smart Farming",
                Font = new Font("Segoe UI", 11F, FontStyle.Bold),
                ForeColor = Color.FromArgb(167, 243, 208),
                AutoSize = false,
                Location = new Point(22, 18),
                Size = new Size(365, 26),
            };
            Label status = new Label
            {
                Text = "Starting local Waitress + Flask server from:\n" + repoRoot,
                Font = new Font("Segoe UI", 8.5F),
                ForeColor = Color.FromArgb(209, 250, 229),
                Location = new Point(22, 48),
                Size = new Size(365, 38),
            };
            ProgressBar bar = new ProgressBar
            {
                Style = ProgressBarStyle.Marquee,
                MarqueeAnimationSpeed = 28,
                Location = new Point(22, 95),
                Size = new Size(360, 18),
            };

            splash.Controls.Add(title);
            splash.Controls.Add(status);
            splash.Controls.Add(bar);

            splash.Shown += (s, e) =>
            {
                Task.Run(() =>
                {
                    DateTime deadline = DateTime.UtcNow.AddSeconds(30);
                    while (DateTime.UtcNow < deadline)
                    {
                        string ready = ProbeCandidateUrls(new[] { "http://127.0.0.1:5000", "http://127.0.0.1:5173" });
                        if (!string.IsNullOrEmpty(ready))
                        {
                            resultUrl = ready;
                            break;
                        }
                        Thread.Sleep(400);
                    }
                    try
                    {
                        splash.Invoke(new Action(() => splash.Close()));
                    }
                    catch { }
                });
            };

            splash.ShowDialog();
            return resultUrl;
        }

        private static void ShowConnectDialog(string suggestedUrl, string suggestedRepo)
        {
            Form form = new Form
            {
                Text = "Kshetra Desktop — Connect or Start Server",
                Width = 520,
                Height = 335,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                StartPosition = FormStartPosition.CenterScreen,
                BackColor = Color.FromArgb(15, 24, 21),
                ForeColor = Color.White,
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath),
            };

            Label header = new Label
            {
                Text = "Connect Kshetra Desktop App",
                Font = new Font("Segoe UI", 12F, FontStyle.Bold),
                ForeColor = Color.FromArgb(110, 231, 183),
                Location = new Point(20, 16),
                Size = new Size(465, 28),
            };

            Label desc = new Label
            {
                Text = "No local server is running right now. Connect to a live LAN/HTTPS Kshetra URL, or pick your extracted Kshetra / terrawise-ai project folder to auto-start it.",
                Font = new Font("Segoe UI", 9F),
                ForeColor = Color.FromArgb(214, 211, 209),
                Location = new Point(20, 46),
                Size = new Size(465, 38),
            };

            Label urlLabel = new Label
            {
                Text = "Kshetra Server / Public HTTPS / LAN URL:",
                Font = new Font("Segoe UI", 8.5F, FontStyle.Bold),
                ForeColor = Color.FromArgb(253, 230, 138),
                Location = new Point(20, 96),
                Size = new Size(340, 18),
            };

            TextBox urlBox = new TextBox
            {
                Text = !string.IsNullOrEmpty(suggestedUrl) ? suggestedUrl : "http://127.0.0.1:5000",
                Font = new Font("Consolas", 9.5F),
                Location = new Point(20, 118),
                Size = new Size(350, 26),
            };

            Button connectBtn = new Button
            {
                Text = "Connect",
                Location = new Point(380, 116),
                Size = new Size(105, 28),
                BackColor = Color.FromArgb(5, 150, 105),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
            };

            Label folderLabel = new Label
            {
                Text = "Or select local project folder containing start.py:",
                Font = new Font("Segoe UI", 8.5F, FontStyle.Bold),
                ForeColor = Color.FromArgb(167, 243, 208),
                Location = new Point(20, 164),
                Size = new Size(380, 18),
            };

            Button browseBtn = new Button
            {
                Text = "Browse Local Folder & Auto-Start Server...",
                Location = new Point(20, 188),
                Size = new Size(465, 32),
                BackColor = Color.FromArgb(28, 45, 39),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
            };

            Label feedbackLabel = new Label
            {
                Text = "",
                Font = new Font("Segoe UI", 8.5F),
                ForeColor = Color.FromArgb(252, 165, 165),
                Location = new Point(20, 230),
                Size = new Size(465, 26),
            };

            Button retryBtn = new Button
            {
                Text = "Retry Localhost Check",
                Location = new Point(20, 260),
                Size = new Size(175, 28),
                BackColor = Color.FromArgb(41, 37, 36),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
            };

            Button closeBtn = new Button
            {
                Text = "Close",
                Location = new Point(390, 260),
                Size = new Size(95, 28),
                BackColor = Color.FromArgb(41, 37, 36),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
            };

            connectBtn.Click += (s, e) =>
            {
                string candidate = urlBox.Text.Trim().TrimEnd('/');
                if (!IsHttpUrl(candidate))
                {
                    feedbackLabel.Text = "Please enter a valid URL starting with http:// or https://";
                    return;
                }
                feedbackLabel.ForeColor = Color.FromArgb(167, 243, 208);
                feedbackLabel.Text = "Checking " + candidate + " ...";
                form.Refresh();
                if (IsReachable(candidate))
                {
                    Directory.CreateDirectory(AppStateDir);
                    File.WriteAllText(SavedUrlPath, candidate + Environment.NewLine, Encoding.UTF8);
                    form.Hide();
                    OpenAndExit(candidate);
                    form.Close();
                }
                else
                {
                    feedbackLabel.ForeColor = Color.FromArgb(252, 165, 165);
                    feedbackLabel.Text = "Could not reach " + candidate + ". Make sure share_app.bat or server is active.";
                }
            };

            browseBtn.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Select the extracted Kshetra / terrawise-ai folder containing start.py";
                    if (!string.IsNullOrEmpty(suggestedRepo) && Directory.Exists(suggestedRepo))
                    {
                        fbd.SelectedPath = suggestedRepo;
                    }
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        string chosen = fbd.SelectedPath;
                        if (!IsKshetraRepoDir(chosen))
                        {
                            feedbackLabel.ForeColor = Color.FromArgb(252, 165, 165);
                            feedbackLabel.Text = "Selected folder does not contain start.py + backend\\wsgi.py.";
                            return;
                        }
                        Directory.CreateDirectory(AppStateDir);
                        File.WriteAllText(SavedRepoPath, chosen + Environment.NewLine, Encoding.UTF8);
                        form.Hide();
                        string booted = StartRepoWithSplash(chosen);
                        if (!string.IsNullOrEmpty(booted))
                        {
                            OpenAndExit(booted);
                            form.Close();
                        }
                        else
                        {
                            form.Show();
                            feedbackLabel.ForeColor = Color.FromArgb(252, 165, 165);
                            feedbackLabel.Text = "Python start.py did not respond in 30s. Run start.bat in that folder once to check Python packages.";
                        }
                    }
                }
            };

            retryBtn.Click += (s, e) =>
            {
                string quick = ProbeCandidateUrls(LocalCandidateUrls);
                if (!string.IsNullOrEmpty(quick))
                {
                    form.Hide();
                    OpenAndExit(quick);
                    form.Close();
                }
                else
                {
                    feedbackLabel.ForeColor = Color.FromArgb(252, 165, 165);
                    feedbackLabel.Text = "Still no running server on localhost:5173 or localhost:5000.";
                }
            };

            closeBtn.Click += (s, e) => form.Close();

            form.Controls.AddRange(new Control[]
            {
                header, desc, urlLabel, urlBox, connectBtn,
                folderLabel, browseBtn, feedbackLabel, retryBtn, closeBtn
            });
            Application.Run(form);
        }

        private static bool LaunchAppWindow(string url)
        {
            string profileDir = Path.Combine(AppStateDir, "DesktopProfile");
            Directory.CreateDirectory(profileDir);

            string[] browserPaths = new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe"),
            };

            foreach (string browserExe in browserPaths)
            {
                if (File.Exists(browserExe))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = browserExe,
                        Arguments = string.Format("--app=\"{0}\" --user-data-dir=\"{1}\" --new-window", url, profileDir),
                        UseShellExecute = false,
                    });
                    return true;
                }
            }
            return false;
        }
    }
}
