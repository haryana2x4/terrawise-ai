using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Kshetra Precision Smart Farming Desktop")]
[assembly: AssemblyProduct("Kshetra Desktop")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace KshetraDesktop
{
    internal static class Program
    {
        private static readonly string[] DefaultCandidateUrls = new[]
        {
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5000",
        };

        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string targetUrl = ResolveExplicitUrl(args, baseDir);

            if (string.IsNullOrEmpty(targetUrl))
            {
                targetUrl = FindReachableUrl(DefaultCandidateUrls);
            }

            if (string.IsNullOrEmpty(targetUrl))
            {
                string repoRoot = FindRepoRoot(baseDir);
                if (!string.IsNullOrEmpty(repoRoot))
                {
                    StartLocalBackend(repoRoot);
                    DateTime deadline = DateTime.UtcNow.AddSeconds(25);
                    while (DateTime.UtcNow < deadline)
                    {
                        targetUrl = FindReachableUrl(new[] { "http://127.0.0.1:5000", "http://127.0.0.1:5173" });
                        if (!string.IsNullOrEmpty(targetUrl))
                        {
                            break;
                        }
                        Thread.Sleep(450);
                    }
                }
            }

            if (string.IsNullOrEmpty(targetUrl))
            {
                MessageBox.Show(
                    "Kshetra server could not be reached automatically.\n\n" +
                    "Start Kshetra first with:\n  python start.py\n\n" +
                    "Or place your hosted/LAN URL inside kshetra-url.txt next to this .exe file.",
                    "Kshetra Desktop",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
                return;
            }

            if (!LaunchAppWindow(targetUrl))
            {
                Process.Start(new ProcessStartInfo(targetUrl) { UseShellExecute = true });
            }
        }

        private static string ResolveExplicitUrl(string[] args, string baseDir)
        {
            if (args != null && args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]))
            {
                string candidate = args[0].Trim();
                if (candidate.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                    candidate.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    return candidate;
                }
            }

            string configPath = Path.Combine(baseDir, "kshetra-url.txt");
            if (File.Exists(configPath))
            {
                foreach (string raw in File.ReadAllLines(configPath))
                {
                    string line = raw.Trim();
                    if (!string.IsNullOrEmpty(line) && !line.StartsWith("#"))
                    {
                        return line;
                    }
                }
            }
            return null;
        }

        private static string FindReachableUrl(string[] candidates)
        {
            foreach (string url in candidates)
            {
                if (ProbeHttp(url.TrimEnd('/') + "/healthz") || ProbeHttp(url))
                {
                    return url;
                }
            }
            return null;
        }

        private static bool ProbeHttp(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "GET";
                req.Timeout = 1500;
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

        private static string FindRepoRoot(string baseDir)
        {
            DirectoryInfo dir = new DirectoryInfo(baseDir);
            for (int depth = 0; depth < 5 && dir != null; depth++)
            {
                if (File.Exists(Path.Combine(dir.FullName, "start.py")) &&
                    Directory.Exists(Path.Combine(dir.FullName, "backend")))
                {
                    return dir.FullName;
                }
                dir = dir.Parent;
            }
            return null;
        }

        private static void StartLocalBackend(string repoRoot)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "python",
                    Arguments = "start.py --no-browser --share --prod",
                    WorkingDirectory = repoRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                Process.Start(psi);
            }
            catch
            {
                // Ignore auto-launch failure; caller reports instructions cleanly.
            }
        }

        private static bool LaunchAppWindow(string url)
        {
            string profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Kshetra",
                "DesktopProfile"
            );
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
