import React, { useState } from "react";
import { Autocomplete } from "@material-ui/lab";
import CircularProgress from "@material-ui/core/CircularProgress";
import { useGenesQuery } from "./../../hooks/genes";
import { OutlinedInput, useTheme } from "@material-ui/core";
import { Search } from "@material-ui/icons";
import { Gene } from "../../typings";

interface GeneAutocompleteProps {
    fullWidth?: boolean;
    onSelect: (result: Gene) => void;
}

const GeneAutocomplete: React.FC<GeneAutocompleteProps> = ({ fullWidth, onSelect }) => {
    const [search, setSearch] = useState<string>("");

    // todo, wrap in fuction that takes minLength and pass in as prop for reuse
    const { data: results, isFetching } = useGenesQuery(
        {
            search,
        },
        search.length > 2
    );

    const theme = useTheme();

    return (
        <Autocomplete
            autoComplete
            clearOnEscape
            //freeSolo include if we want them to enter anything, meaning we could get a string back if no match
            fullWidth={fullWidth}
            getOptionSelected={(option, value) => option.gene_id === value.gene_id}
            getOptionLabel={option => option?.hgnc_gene_name}
            includeInputInList={true}
            noOptionsText="No Results"
            options={results?.data || []}
            loading={isFetching}
            onInputChange={(event, newInputValue) => {
                //prevent requery on select
                if (!(results?.data || []).map(o => o.hgnc_gene_name).includes(newInputValue)) {
                    setSearch(newInputValue);
                }
            }}
            onChange={(
                event: React.ChangeEvent<{}>,
                selectedValue: Gene | null,
                reason: string
            ) => {
                if (search && reason !== "clear" && selectedValue) {
                    setSearch("");
                    onSelect(selectedValue);
                }
            }}
            renderInput={params => {
                const { InputLabelProps, InputProps, ...rest } = params;
                return (
                    <OutlinedInput
                        placeholder="Search by gene identifier"
                        {...rest}
                        {...InputProps}
                        startAdornment={
                            <Search fontSize={"small"} htmlColor={theme.palette.grey[600]} />
                        }
                        endAdornment={isFetching ? <CircularProgress size={16} /> : null}
                    />
                );
            }}
        />
    );
};

export default GeneAutocomplete;
