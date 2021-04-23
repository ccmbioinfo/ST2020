import React from "react";
import { TextField } from "@material-ui/core";
import { EditComponentProps } from "material-table";

/**
 * Render note input for a material table column
 * 'any' generic required b/c material table does not infer row data type and row \ 
 *    data is not accessed by the function)
 *
 */
export default function EditNotes({ value, onChange }: EditComponentProps<any>) {
    return (
        <TextField
            multiline
            value={value}
            onChange={event => onChange(event.target.value)}
            rows={4}
            fullWidth
        />
    );
}
