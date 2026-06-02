{ pkgs, ... }:

{
  config.dot.programs.navi.cheats.archive.sections = [
    {
      tags = [
        "tar"
        "archive"
      ];
      variables = {
        files = "${pkgs.coreutils}/bin/ls";
        tar_archived_files = "${pkgs.fd}/bin/fd -t f -e gz -e bz2 -e xz";
        zip_file = "${pkgs.fd}/bin/fd -t f -e zip";
        compression_level = "${pkgs.coreutils}/bin/seq 0 9";
      };
      entries = [
        {
          description = "compress to tar.gz";
          command = "tar czf <output>.tar.gz <files>";
        }
        {
          description = "extract gz/bz2/xz";
          command = "tar xvf <tar_archived_files>";
        }
        {
          description = "compress to zip";
          command = "zip -r <output>.zip <files>";
        }
        {
          description = "compress to zip with compression level";
          command = "zip -r <compression_level> <output>.zip <files>";
        }
        {
          description = "extract zip";
          command = "unzip <zip_file>";
        }
      ];
    }
  ];
}
