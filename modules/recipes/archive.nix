{
  config.dot.programs.navi.cheats.archive.sections = [
    {
      tags = [
        "tar"
        "archive"
      ];
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
      variables = {
        files = "ls";
        tar_archived_files = "fd -t f -e gz -e bz2 -e xz";
        zip_file = "fd -t f -e zip";
        compression_level = "seq 0 9";
      };
    }
  ];
}
