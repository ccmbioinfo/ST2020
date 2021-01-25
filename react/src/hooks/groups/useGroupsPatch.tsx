import { useMutation, useQueryClient } from "react-query";
import { Group } from "../../typings";

async function patchGroup(newGroup: Group) {
    // group_code is immutable
    const { group_code, ...group } = newGroup;
    const response = await fetch("/api/groups/" + group_code, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(group),
    });
    if (response.ok) {
        return response.json();
    } else {
        throw response;
    }
}

/**
 * Return a mutation object for PATCH /api/groups/:id.
 *
 * Used for updating fields for an existing group.
 */
export function useGroupsPatch() {
    const queryClient = useQueryClient();
    const mutation = useMutation<Group, Response, Group>(patchGroup, {
        onSuccess: updatedGroup => {
            // successfully patched, so we can update cache immediately
            queryClient.setQueryData(
                ["groups", updatedGroup.group_code.toLowerCase()],
                updatedGroup
            );

            const existingGroups: Group[] | undefined = queryClient.getQueryData("groups");
            if (existingGroups !== undefined) {
                queryClient.setQueryData(
                    "groups",
                    existingGroups.map(group =>
                        group.group_code === updatedGroup.group_code ? updatedGroup : group
                    )
                );
            } else {
                queryClient.invalidateQueries("groups");
            }
        },
    });
    return mutation;
}
