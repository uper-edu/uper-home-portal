CREATE TABLE crm_payment_ledgers(lead_id VARCHAR(191) PRIMARY KEY,revision INT NOT NULL DEFAULT 0,value JSON NOT NULL,FOREIGN KEY(lead_id) REFERENCES portal_leads(id)) ENGINE=InnoDB;
CREATE TABLE crm_payment_references(fingerprint CHAR(64) PRIMARY KEY,lead_id VARCHAR(191) NOT NULL,entry_id CHAR(36) NOT NULL,FOREIGN KEY(lead_id) REFERENCES portal_leads(id)) ENGINE=InnoDB;
