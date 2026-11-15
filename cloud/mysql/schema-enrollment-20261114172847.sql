CREATE TABLE IF NOT EXISTS enrollment_classes (
  id VARCHAR(64) PRIMARY KEY,
  course_id VARCHAR(100) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  state VARCHAR(16) NOT NULL,
  first_lesson_at DATETIME(6) NOT NULL,
  enrollment_closes_at DATETIME(6) NOT NULL,
  data JSON NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  KEY enrollment_class_catalog (state, first_lesson_at),
  KEY enrollment_class_course (course_id, first_lesson_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
