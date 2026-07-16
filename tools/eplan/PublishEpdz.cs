// PublishEpdz.cs — EPLAN Electric P8 script (2022+)
//
// Publishes a project as .epdz (Smart Production), ready to open in the
// Covaga ECAD Viewer.
//

using System;
using System.IO;
using System.Windows.Forms;
using Eplan.EplApi.ApplicationFramework;
using Eplan.EplApi.Base;
using Eplan.EplApi.Scripting;

public class PublishEpdzScript
{
    // ==================== EDIT THESE TWO PATHS ====================
    private const string PROJECT_PATH = @"C:\Projects\EPLAN\MyProject.elk";
    private const string OUTPUT_FILE  = @"C:\Projects\EPLAN\out\MyProject.epdz";
    // ==============================================================

    [Start]
    public void Run()
    {
        try
        {
            if (!File.Exists(PROJECT_PATH))
            {
                MessageBox.Show(
                    "Project not found:" + Environment.NewLine + PROJECT_PATH,
                    "PublishEpdz",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            string dir = Path.GetDirectoryName(OUTPUT_FILE);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            using (ActionCallingContext acc = new ActionCallingContext())
            {
                acc.AddParameter("TYPE", "PUBLISHSMARTPRODUCTION");
                acc.AddParameter("PROJECTNAME", PROJECT_PATH);
                acc.AddParameter("FILENAME", OUTPUT_FILE);
                new CommandLineInterpreter().Execute("projectmanagement", acc);
            }

            MessageBox.Show(
                "Project published:" + Environment.NewLine + OUTPUT_FILE,
                "PublishEpdz",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
        catch (Exception ex)
        {
            new BaseException("PublishEpdz: " + ex.Message, MessageLevel.Error).FixMessage();
            MessageBox.Show(ex.Message, "PublishEpdz — Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
