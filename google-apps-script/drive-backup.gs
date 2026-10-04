/**
 * Nhận file backup SQL từ shop và lưu vào Google Drive.
 * Dán cả file này vào Apps Script, rồi Deploy → Manage deployments → Edit →
 * Version: New version → Deploy. URL /exec giữ nguyên.
 *
 * File nằm trong thư mục "ShopVD Database Backups" trên Drive của tài khoản deploy.
 * Thư mục được tạo lần đầu. Chỉ giữ 14 file shopvd_backup_*.sql mới nhất.
 */

var BACKUP_FOLDER_NAME = 'ShopVD Database Backups';
var DEFAULT_KEEP = 14;
var DRIVE_BACKUP_SECRET = '12914bfc215f67349f428fcae7e587685f63158b8e84a30e';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    if (body.type !== 'database-backup') {
      return json({ success: false, error: 'Sai loại yêu cầu' });
    }

    if (body.secret !== DRIVE_BACKUP_SECRET) {
      return json({ success: false, error: 'Sai mã bảo mật' });
    }
    if (!isBackupFileName(body.fileName) || typeof body.sql !== 'string' || body.sql.length === 0) {
      return json({ success: false, error: 'File backup không hợp lệ' });
    }

    var folder = getBackupFolder();
    var file = folder.createFile(body.fileName, body.sql, MimeType.PLAIN_TEXT);
    var removed = pruneOldBackups(folder, normalizeKeep(body.keep));
    return json({
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      removed: removed
    });
  } catch (error) {
    return json({ success: false, error: String(error && error.message ? error.message : error) });
  }
}

function isBackupFileName(name) {
  return typeof name === 'string' && /^shopvd_backup_[A-Za-z0-9T_-]+\.sql$/.test(name);
}

function normalizeKeep(value) {
  var keep = parseInt(value, 10);
  if (!keep || keep < 1 || keep > 60) return DEFAULT_KEEP;
  return keep;
}

function getBackupFolder() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('DRIVE_BACKUP_FOLDER_ID');
  if (folderId) return DriveApp.getFolderById(folderId);

  var found = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  var folder = found.hasNext() ? found.next() : DriveApp.createFolder(BACKUP_FOLDER_NAME);
  props.setProperty('DRIVE_BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

function pruneOldBackups(folder, keep) {
  var files = [];
  var iterator = folder.getFiles();
  while (iterator.hasNext()) {
    var file = iterator.next();
    if (isBackupFileName(file.getName())) files.push(file);
  }
  files.sort(function(a, b) {
    return b.getDateCreated().getTime() - a.getDateCreated().getTime();
  });
  var removed = 0;
  for (var i = keep; i < files.length; i++) {
    files[i].setTrashed(true);
    removed++;
  }
  return removed;
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
