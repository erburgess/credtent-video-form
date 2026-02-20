CREATE TABLE `assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255),
	`contactName` varchar(255),
	`contactEmail` varchar(320),
	`submissionEmail` varchar(320),
	`companyAnswers` json,
	`contentEntries` json,
	`contentTypes` text,
	`notes` text,
	`status` enum('submitted','reviewed','in_progress','archived') NOT NULL DEFAULT 'submitted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
