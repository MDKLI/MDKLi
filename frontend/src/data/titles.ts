export const titles = [
	{ id: "professor", name: "Professor" },
	{ id: "lecturer", name: "Lecturer" },
	{ id: "consultant", name: "Consultant" },
	{ id: "specialist", name: "Specialist" },
];

export const getTitleById = (id: string) => {
	return titles.find((t) => t.id === id);
};
