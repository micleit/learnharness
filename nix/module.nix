{
  config,
  lib,
  pkgs,
  ...
}:
with lib;
let
  cfg = config.services.learnharness;
in
{
  options.services.learnharness = {
    enable = mkEnableOption "LearnHarness adaptive teaching and knowledge graph server";

    package = mkOption {
      type = types.package;
      description = "The LearnHarness package to run.";
    };

    port = mkOption {
      type = types.port;
      default = 8383;
      description = "Port to bind LearnHarness server to.";
    };

    host = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Host IP to bind LearnHarness server to.";
    };

    dataDir = mkOption {
      type = types.str;
      default = "/var/lib/learnharness/data";
      description = "Directory for mutable data (chats, graph, settings).";
    };

    authFile = mkOption {
      type = types.str;
      default = "/var/lib/learnharness/auth.json";
      description = "Path to auth.json file storing LLM provider API keys.";
    };

    passwordFile = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = "Path to file containing raw server password for user authentication.";
    };

    user = mkOption {
      type = types.str;
      default = "learnharness";
      description = "User to run LearnHarness service under.";
    };

    group = mkOption {
      type = types.str;
      default = "learnharness";
      description = "Group to run LearnHarness service under.";
    };

    openFirewall = mkOption {
      type = types.bool;
      default = false;
      description = "Open port in firewall (not needed when using local reverse proxy or Cloudflare Tunnel).";
    };
  };

  config = mkIf cfg.enable {
    # 1. State directories with proper permissions
    systemd.tmpfiles.rules = [
      "d ${dirOf cfg.dataDir} 0700 ${cfg.user} ${cfg.group} - -"
      "d ${cfg.dataDir} 0700 ${cfg.user} ${cfg.group} - -"
    ];

    # 2. System user and group accounts
    users.users = mkIf (cfg.user == "learnharness") {
      learnharness = {
        isSystemUser = true;
        group = cfg.group;
        home = "/var/lib/learnharness";
        createHome = true;
      };
    };

    users.groups = mkIf (cfg.group == "learnharness") {
      learnharness = {};
    };

    # 3. Systemd service
    systemd.services.learnharness = {
      description = "LearnHarness AI Learning Server";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      environment = {
        PORT = toString cfg.port;
        HOSTNAME = cfg.host;
        LH_DATA_DIR = cfg.dataDir;
        LH_AUTH_FILE = cfg.authFile;
        NODE_ENV = "production";
      } // optionalAttrs (cfg.passwordFile != null) {
        LH_PASSWORD_FILE = toString cfg.passwordFile;
      };

      serviceConfig = {
        ExecStart = "${cfg.package}/bin/learnharness";
        WorkingDirectory = "${cfg.package}/lib/learnharness";
        Restart = "always";
        RestartSec = "5s";
        User = cfg.user;
        Group = cfg.group;

        # Hardening
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        NoNewPrivileges = true;
        ReadWritePaths = [
          "/var/lib/learnharness"
          (dirOf cfg.dataDir)
          cfg.dataDir
          (dirOf cfg.authFile)
        ];
      };
    };

    # 4. Firewall (if enabled)
    networking.firewall.allowedTCPPorts = mkIf cfg.openFirewall [ cfg.port ];
  };
}
